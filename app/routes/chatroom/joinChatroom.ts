import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';

const joinChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/join',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { id: chatroomId } = params;
    const userAid = (req as any)?.userAid;
    const username = (req as any)?.username;

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

    // Check if user is already a participant
    const isParticipant = chatroom.participants.some(p => p.userAid === userAid);

    if (isParticipant) {
      return {
        message: 'User is already a participant in this chatroom',
        statusCode: 409,
        success: false,
        status: 'bad',
      };
    }

    chatroom.participants.push({ 
      userAid, 
      username, 
      publicKey: (req as any).session?.publicKey,
      exchangePublicKey: (req as any).session?.exchangePublicKey,
      joinedAt: new Date() 
    });
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
