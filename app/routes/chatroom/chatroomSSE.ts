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

  console.log(`[SSE] Client connected: ${userAid} for room ${chatroomId}`);

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

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(details)}\n\n`);
      }
    } catch (error) {
      console.error(`[SSE] Error sending update for room ${chatroomId}:`, error);
    }
  };

  // Heartbeat to keep connection alive and detect disconnects
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 30000); // 30 seconds

  let updateTimeout: NodeJS.Timeout | null = null;
  const sendUpdateDebounced = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(sendUpdate, 150); // 150ms debounce
  };

  // Listen for chatroom update events for this specific room
  const eventName = `chatroomUpdated:${chatroomId}`;
  chatEventEmitter.on(eventName, sendUpdateDebounced);

  // Listen for user removal events
  const removalEventName = `userRemoved:${chatroomId}`;
  const handleUserRemoved = (data: { chatroomId: string, userAid: string }) => {
    if (data.userAid === userAid && !res.writableEnded) {
      res.write(`event: removed\ndata: ${JSON.stringify({ message: 'You have been removed from the room' })}\n\n`);
    }
  };
  chatEventEmitter.on(removalEventName, handleUserRemoved);

  // Initial send
  await sendUpdate();

  // Clean up when connection closes
  req.on('close', () => {
    console.log(`[SSE] Client disconnected: ${userAid} for room ${chatroomId}`);
    clearInterval(heartbeatInterval);
    if (updateTimeout) clearTimeout(updateTimeout);
    chatEventEmitter.off(eventName, sendUpdateDebounced);
    chatEventEmitter.off(removalEventName, handleUserRemoved);
    if (!res.writableEnded) {
      res.end();
    }
  });
});

export default router;
