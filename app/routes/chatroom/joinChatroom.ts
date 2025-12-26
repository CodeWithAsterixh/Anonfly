import ChatRoom from '../../../lib/models/chatRoom.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import { verifyToken } from '../../../lib/middlewares/verifyToken.ts';

const joinChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/join',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { id: chatroomId } = params;
    const userId = (req.user as any)?._id;
    const username = (req.user as any)?.username;

    if (!userId) {
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

    // Check if user is already a participant
    const isParticipant = chatroom.participants.some(p => p.userId.toString() === userId.toString());

    if (isParticipant) {
      return {
        message: 'User is already a participant in this chatroom',
        statusCode: 409,
        success: false,
        status: 'bad',
      };
    }

    chatroom.participants.push({ userId, username, joinedAt: new Date() });
    await chatroom.save();

    return {
      message: 'Successfully joined chatroom',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { chatroomId: chatroom._id, roomname: chatroom.roomname },
    };
  }),
};

export default joinChatroomRoute;
