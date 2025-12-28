import { Router } from 'express';
import ChatRoom from '../../../lib/models/chatRoom';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';

const router = Router();

/**
 * SSE route for real-time chatroom details (name, description, participant count, etc.)
 */
router.get('/chatroom/:chatroomId/details/sse', verifyToken, async (req, res) => {
  const { chatroomId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = async () => {
    try {
      if (res.writableEnded) return;
      
      const chatroom = await ChatRoom.findById(chatroomId).select(
        "roomname description hostAid participants isLocked"
      );

      if (!chatroom) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Chatroom not found' })}\n\n`);
        return;
      }

      const details = {
        roomId: chatroom._id,
        roomname: chatroom.roomname,
        description: chatroom.description,
        hostAid: chatroom.hostAid,
        isLocked: chatroom.isLocked || false,
        participantCount: chatroom.participants.length,
      };

      res.write(`data: ${JSON.stringify(details)}\n\n`);
    } catch (error) {
      // Silently fail update
    }
  };

  // Initial send
  await sendUpdate();

  // Listen for chatroom update events for this specific room
  const eventName = `chatroomUpdated:${chatroomId}`;
  chatEventEmitter.on(eventName, sendUpdate);

  // Clean up when connection closes
  req.on('close', () => {
    chatEventEmitter.off(eventName, sendUpdate);
    res.end();
  });
});

export default router;
