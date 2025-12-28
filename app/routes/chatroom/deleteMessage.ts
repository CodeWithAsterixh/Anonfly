import { WebSocket } from 'ws';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import ChatRoom from '../../../lib/models/chatRoom';
import { activeChatrooms } from '../../index';
import { verifyToken } from '../../../lib/middlewares/verifyToken';

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

    if (chatroom.messages[messageIndex].senderAid !== userAid) {
      return {
        message: 'You are not authorized to delete this message',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    chatroom.messages.splice(messageIndex, 1);
    await chatroom.save();

    const chatroomClients = activeChatrooms.get(chatroomId);
    if (chatroomClients) {
      const messageToBroadcast = JSON.stringify({
        type: 'messageDeleted',
        chatroomId,
        messageId,
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
