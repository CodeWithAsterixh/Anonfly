import { WebSocket } from 'ws';
import { updateMessageInCache } from '../../../lib/helpers/messageCache';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import ChatRoom from '../../../lib/models/chatRoom';
import Message from '../../../lib/models/message';
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

    const message = await Message.findById(messageId);

    if (!message) {
      return {
        message: 'Message not found',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    if (message.senderAid !== userAid && chatroom.hostAid !== userAid) {
      return {
        message: 'You are not authorized to delete this message',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    message.isDeleted = true;
    message.content = "[This message was deleted]";
    message.signature = undefined; // Remove signature for deleted messages
    await message.save();

    // Update replies to this message
    await Message.updateMany(
      { chatroomId: chatroom._id, "replyTo.messageId": messageId },
      { $set: { "replyTo.content": "[This message was deleted]" } }
    );

    // Update cache for the deleted message
    await updateMessageInCache(chatroomId, {
      ...message.toObject(),
      id: message._id.toString(),
      chatroomId: chatroomId,
    });

    // Also update cache for any messages that were replies to this message
    // We fetch them to update cache correctly
    const repliesToUpdate = await Message.find({ chatroomId: chatroom._id, "replyTo.messageId": messageId });
    for (const reply of repliesToUpdate) {
      await updateMessageInCache(chatroomId, {
        ...reply.toObject(),
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
