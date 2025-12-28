import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';

const deleteChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'delete',
  path: '/chatrooms/:id',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { id: chatroomId } = params;
    const userAid = (req as any)?.userAid;

    if (!userAid) {
      return {
        message: 'User not authenticated',
        statusCode: 401,
        success: false,
        status: 'bad',
      };
    }

    if (!chatroomId) {
      return {
        message: 'Chatroom ID is required',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    const chatroom = await ChatRoom.findById(chatroomId);

    if (!chatroom) {
      return {
        message: 'Chatroom not found',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    // Check if the authenticated user is the host of the chatroom
    if (chatroom.hostAid !== userAid) {
      return {
        message: 'Unauthorized: Only the host can delete this chatroom',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    await ChatRoom.deleteOne({ _id: chatroomId });

    return {
      message: 'Chatroom deleted successfully',
      statusCode: 200,
      success: true,
      status: 'good',
    };
  }),
};

export default deleteChatroomRoute;
