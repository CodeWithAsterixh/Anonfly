import { Router } from 'express';
import ChatRoom from '../../../lib/models/chatRoom';
import type { IParticipant } from '../../../lib/models/chatRoom';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { getCachedChatroomList, cacheChatroomList, invalidateChatroomList } from '../../../lib/helpers/messageCache';

const router = Router();

/**
 * Fetches the list of chatrooms and formats them for the client.
 */
async function getFormattedChatroomList(userAid: string, userRegion?: string) {
  // Try to get raw list from cache
  let chatrooms = await getCachedChatroomList();

  if (!chatrooms) {
    chatrooms = await ChatRoom.aggregate([
      {
        $addFields: {
          lastMessage: {
            $arrayElemAt: ["$messages", -1]
          }
        }
      },
      {
        $project: {
          _id: 1,
          roomname: 1,
          description: 1,
          region: 1,
          hostAid: 1,
          participants: 1,
          isLocked: 1,
          lastMessage: "$lastMessage.content",
        }
      }
    ]);
    
    // Cache the raw list
    await cacheChatroomList(chatrooms);
  }

  const formattedRooms = chatrooms.map(room => {
    const lastMessageContent = room.lastMessage || null;
    const isParticipant = room.participants.some((p: IParticipant) => p.userAid === userAid);

    return {
      id: room._id,
      roomname: room.roomname,
      description: room.description,
      region: room.region,
      hostAid: room.hostAid,
      participantCount: room.participants.length,
      isLocked: room.isLocked || false,
      lastMessage: isParticipant ? lastMessageContent : null,
    };
  });

  // Sort: prioritize rooms in the same region
  if (userRegion) {
    formattedRooms.sort((a, b) => {
      if (a.region === userRegion && b.region !== userRegion) return -1;
      if (a.region !== userRegion && b.region === userRegion) return 1;
      return 0;
    });
  }

  return formattedRooms;
}

router.get(['/chatrooms', '/chatrooms/'], verifyToken, async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userAid = (req as any).userAid;
  const userRegion = req.query.region as string;

  // Initial send
  try {
    const chatroomList = await getFormattedChatroomList(userAid, userRegion);
    res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
  } catch (error) {
    // Silently fail initial send
  }

  // Define the update handler
  const sendUpdate = async () => {
    try {
      if (res.writableEnded) return;
      // Invalidate cache before fetching new list
      await invalidateChatroomList();
      const chatroomList = await getFormattedChatroomList(userAid, userRegion);
      res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
    } catch (error) {
      // Silently fail update
    }
  };

  // Listen for all relevant events that should update the list
  chatEventEmitter.on('chatroomCreated', sendUpdate);
  chatEventEmitter.on('chatroomDeleted', sendUpdate);
  chatEventEmitter.on('chatroomListUpdated', sendUpdate);

  // Clean up when connection closes
  req.on('close', () => {
    chatEventEmitter.off('chatroomCreated', sendUpdate);
    chatEventEmitter.off('chatroomDeleted', sendUpdate);
    chatEventEmitter.off('chatroomListUpdated', sendUpdate);
    res.end();
  });
});

export default router;
