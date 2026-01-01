import { Router } from 'express';
import ChatRoom from '../../../lib/models/chatRoom';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { getPermissionsByUserId } from '../../../lib/helpers/permissionHelper';

const router = Router();

/**
 * SSE route for real-time chatroom details (name, description, participant count, etc.)
 */
router.get('/chatroom/:chatroomId/details/sse', verifyToken, async (req, res) => {
  const { chatroomId } = req.params;
  const userAid = (req as any)?.userAid;

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

      let allowedFeatures: string[] = [];
      if (userAid === chatroom.hostAid) {
        const permission = await getPermissionsByUserId(userAid);
        if (permission) {
          allowedFeatures = permission.allowedFeatures;
        }
      }

      const details = {
        roomId: chatroom._id,
        roomname: chatroom.roomname,
        description: chatroom.description,
        hostAid: chatroom.hostAid,
        isLocked: chatroom.isLocked || false,
        participantCount: chatroom.participants.filter(p => !p.leftAt).length,
        allowedFeatures,
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

  // Listen for user removal events
  const removalEventName = `userRemoved:${chatroomId}`;
  const handleUserRemoved = (data: { chatroomId: string, userAid: string }) => {
    if (data.userAid === userAid) {
      res.write(`event: removed\ndata: ${JSON.stringify({ message: 'You have been removed from the room' })}\n\n`);
      // We don't call res.end() immediately to allow the client to receive the message
      // The client should close the connection upon receiving this event
    }
  };
  chatEventEmitter.on(removalEventName, handleUserRemoved);

  // Clean up when connection closes
  req.on('close', () => {
    chatEventEmitter.off(eventName, sendUpdate);
    chatEventEmitter.off(removalEventName, handleUserRemoved);
    res.end();
  });
});

export default router;
