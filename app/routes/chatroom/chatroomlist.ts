/// <reference path="../../../lib/types/express.d.ts" />
import { Router } from 'express';
import ChatRoom from '../../../lib/models/chatRoom';
import type { IParticipant } from '../../../lib/models/chatRoom';
import { verifyToken } from '../../../lib/middlewares/verifyToken';

const router = Router();

router.get('/chatrooms', verifyToken, async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers to establish SSE connection immediately

  // Polling interval for updates
  const intervalId = setInterval(async () => {
    try {
      // Fetch all chatrooms
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

      const chatroomList = chatrooms.map(room => {
        const lastMessageContent = room.lastMessage || null;
        const userAid = (req as any).userAid;
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

      // Send the updated list of chatrooms
      res.write(`data: ${JSON.stringify(chatroomList)}\n\n`);
    } catch (error) {
      console.error('Error fetching chatrooms for SSE:', error);
      // Optionally send an error event
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error fetching chatrooms' })}\n\n`);
    }
  }, 5000); // Poll every 5 seconds

  // Handle client disconnection
  req.on('close', () => {
    console.log('Client disconnected from chatroom list SSE');
    clearInterval(intervalId);
    res.end();
  });
});

export default router;
