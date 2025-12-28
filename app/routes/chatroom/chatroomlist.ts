/// <reference path="../../../lib/types/express.d.ts" />
import { Router } from 'express';
import ChatRoom from '../../../lib/models/chatRoom';
import type { IParticipant } from '../../../lib/models/chatRoom';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';

const router = Router();

/**
 * Fetches the list of chatrooms and formats them for the client.
 */
async function getFormattedChatroomList(userAid: string) {
  const chatrooms = await ChatRoom.aggregate([
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
        hostAid: 1,
        participants: 1,
        lastMessage: "$lastMessage.content",
      }
    }
  ]);

  return chatrooms.map(room => {
    const lastMessageContent = room.lastMessage || null;
    const isParticipant = room.participants.some((p: IParticipant) => p.userAid === userAid);

    return {
      id: room._id,
      roomname: room.roomname,
      description: room.description,
      hostAid: room.hostAid,
      participantCount: room.participants.length,
      lastMessage: isParticipant ? lastMessageContent : null,
    };
  });
}

router.get(['/chatrooms', '/chatrooms/'], verifyToken, async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userAid = (req as any).userAid;

  // Initial send
  try {
    const chatroomList = await getFormattedChatroomList(userAid);
    res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
  } catch (error) {
    // Silently fail initial send, the listener might catch next update
  }

  // Define the update handler
  const sendUpdate = async () => {
    try {
      if (res.writableEnded) return;
      const chatroomList = await getFormattedChatroomList(userAid);
      res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
    } catch (error) {
      // Silently fail update
    }
  };

  // Listen for chatroom creation events
  chatEventEmitter.on('chatroomCreated', sendUpdate);

  // Clean up when connection closes
  req.on('close', () => {
    chatEventEmitter.off('chatroomCreated', sendUpdate);
    res.end();
  });
});

export default router;
