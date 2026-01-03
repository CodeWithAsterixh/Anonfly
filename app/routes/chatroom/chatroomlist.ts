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
        $match: {
          isPrivate: { $ne: true }
        }
      },
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

  // Fetch private rooms ONLY if the user is the host
  const privateRooms = await ChatRoom.aggregate([
    {
      $match: {
        isPrivate: true,
        hostAid: userAid
      }
    },
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
        isPrivate: 1,
        lastMessage: "$lastMessage.content",
      }
    }
  ]);

  // Merge public rooms with user's private rooms
  const allRooms = [...chatrooms, ...privateRooms];

  const formattedRooms = allRooms.map(room => {
    const lastMessageContent = room.lastMessage || null;
    const isParticipant = room.participants.some((p: IParticipant) => p.userAid === userAid);

    return {
      id: room._id,
      roomname: room.roomname,
      description: room.description,
      region: room.region,
      hostAid: room.hostAid,
      participantCount: room.participants.filter((p: IParticipant) => !p.leftAt).length,
      isLocked: room.isLocked || false,
      isPrivate: room.isPrivate || false,
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

  // console.log(`[SSE] Client connected for chatroom list: ${userAid}`);

  // Initial send
  try {
    const chatroomList = await getFormattedChatroomList(userAid, userRegion);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
    }
  } catch (error) {
    console.error(`[SSE] Error sending initial chatroom list:`, error);
  }

  // Define the update handler
  const sendUpdate = async () => {
    try {
      if (res.writableEnded) return;
      // Invalidate cache before fetching new list
      await invalidateChatroomList();
      const chatroomList = await getFormattedChatroomList(userAid, userRegion);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
      }
    } catch (error) {
      console.error(`[SSE] Error sending chatroom list update:`, error);
    }
  };

  let updateTimeout: NodeJS.Timeout | null = null;
  const sendUpdateDebounced = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(sendUpdate, 200); // 200ms debounce for list as it's heavier
  };

  // Heartbeat
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 30000);

  // Listen for all relevant events that should update the list
  chatEventEmitter.on('chatroomCreated', sendUpdateDebounced);
  chatEventEmitter.on('chatroomDeleted', sendUpdateDebounced);
  chatEventEmitter.on('chatroomListUpdated', sendUpdateDebounced);

  // Clean up when connection closes
  req.on('close', () => {
    // console.log(`[SSE] Client disconnected from chatroom list: ${userAid}`);
    clearInterval(heartbeatInterval);
    if (updateTimeout) clearTimeout(updateTimeout);
    chatEventEmitter.off('chatroomCreated', sendUpdateDebounced);
    chatEventEmitter.off('chatroomDeleted', sendUpdateDebounced);
    chatEventEmitter.off('chatroomListUpdated', sendUpdateDebounced);
    if (!res.writableEnded) {
      res.end();
    }
  });
});

export default router;
