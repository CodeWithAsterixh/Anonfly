import ChatRoom from '../../../lib/models/chatRoom.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import { verifyToken } from '../../../lib/middlewares/verifyToken.ts';

const getChatroomMessagesRoute: Omit<RouteConfig, 'app'> = {
  method: 'get',
  path: '/:chatroomId/messages',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { chatroomId } = params as { chatroomId: string };

    const chatroom = await ChatRoom.findById(chatroomId).select('messages').lean();

    if (!chatroom) {
      return {
        message: 'Chatroom not found',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    return {
      statusCode: 200,
      success: true,
      status: 'good',
      data: chatroom.messages,
    };
  }),
};

export default getChatroomMessagesRoute;
