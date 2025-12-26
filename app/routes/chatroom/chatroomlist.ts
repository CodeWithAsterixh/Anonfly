import { Router } from 'express';
import ChatRoom from '../../../lib/models/chatRoom.ts';
import type { IParticipant } from '../../../lib/models/chatRoom.ts';

const router = Router();

router.get('/chatrooms', async (req, res) => {
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
              $arrayElemAt: ["$messages", -1] // Get the last message from the embedded array
            }
          }
        },
        {
          $project: {
            _id: 1,
            roomname: 1,
            description: 1,
            hostUserId: 1,
            participants: 1,
            lastMessage: "$lastMessage.content", // Extract content of the last message
          }
        }
      ]);

      const chatroomList = chatrooms.map(room => {
        const lastMessageContent = room.lastMessage || null;
        // NOTE: This part assumes req.user is populated by an authentication middleware
        // and contains the authenticated user's _id.
        const isParticipant = room.participants.some((p: IParticipant) => p.userId.toString() === (req.user as any)?._id?.toString());

        return {
          id: room._id,
          roomname: room.roomname,
          description: room.description,
          hostUserId: room.hostUserId,
          participantCount: room.participants.length,
          lastMessage: isParticipant ? lastMessageContent : null, // Only show preview if participant
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
