import { WebSocket } from 'ws';
import { updateMessageInCache } from '../../../lib/helpers/messageCache';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import ChatRoom from '../../../lib/models/chatRoom';
import { activeChatrooms } from '../../../lib/services/websocket/clientManager';
import type { RouteConfig } from '../../../types/index.d';

const deleteMessageRoute: Omit<RouteConfig, 'app'> = {
  method: 'delete',
  path: '/:chatroomId/messages/:messageId',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { chatroomId, messageId } = params as { chatroomId: string; messageId: string };
    const userAid = (req as any).userAid;

    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom) {
      return {
        message: 'Chatroom not found',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    const messageIndex = chatroom.messages.findIndex(msg => msg._id.toString() === messageId);

    if (messageIndex === -1) {
      return {
        message: 'Message not found',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    if (chatroom.messages[messageIndex].senderAid !== userAid && chatroom.hostAid !== userAid) {
      return {
        message: 'You are not authorized to delete this message',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    chatroom.messages[messageIndex].isDeleted = true;
    chatroom.messages[messageIndex].content = "[This message was deleted]";
    chatroom.messages[messageIndex].signature = undefined; // Remove signature for deleted messages

    // Update replies to this message
    for (const msg of chatroom.messages) {
      if (msg.replyTo?.messageId === messageId) {
        msg.replyTo.content = "[This message was deleted]";
      }
    }

    chatroom.markModified('messages');
    await chatroom.save();

    // Update cache for the deleted message
    const deletedMessage = chatroom.messages[messageIndex];
    await updateMessageInCache(chatroomId, {
      ...(deletedMessage as any).toObject(),
      id: deletedMessage._id.toString(),
      chatroomId: chatroomId,
    });

    // Also update cache for any messages that were replies to this message
    const repliesToUpdate = chatroom.messages.filter(msg => msg.replyTo?.messageId === messageId);
    for (const reply of repliesToUpdate) {
      await updateMessageInCache(chatroomId, {
        ...(reply as any).toObject(),
        id: reply._id.toString(),
        chatroomId: chatroomId,
      });
    }

    const chatroomClients = activeChatrooms.get(chatroomId);
    if (chatroomClients) {
      const messageToBroadcast = JSON.stringify({
        type: 'messageDeleted',
        chatroomId,
        messageId,
        isDeleted: true,
        content: "[This message was deleted]",
      });
      chatroomClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageToBroadcast);
        }
      });
    }

    return {
      message: 'Message deleted successfully',
      statusCode: 200,
      success: true,
      status: 'good',
    };
  }),
};

export default deleteMessageRoute;
