import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';

const getChatroomMessagesRoute: Omit<RouteConfig, 'app'> = {
  method: 'get',
  path: '/:chatroomId/messages',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { chatroomId } = params as { chatroomId: string };

    const chatroom = await ChatRoom.findById(chatroomId).select('messages hostAid participants').lean();

    if (!chatroom) {
      return {
        message: 'Chatroom not found',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    const userAid = (req as any).userAid;
    const isCreator = chatroom.creatorAid === userAid;
    const participant = chatroom.participants.find(p => p.userAid === userAid);

    // SECURITY: If the user is not a participant or has left, they cannot see messages.
    // If they just joined, joinedAt will be set. If it's missing, default to a future date (see nothing).
    if (!participant) {
      return {
        message: 'Access denied: You must be an active participant to view messages.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    const joinedAt = participant.joinedAt ? new Date(participant.joinedAt).getTime() : Date.now();
    const messages = isCreator? chatroom.messages:chatroom.messages.filter(msg => 
      new Date(msg.timestamp).getTime() >= joinedAt
    );

    return {
      statusCode: 200,
      success: true,
      status: 'good',
      data: messages,
    };
  }),
};

export default getChatroomMessagesRoute;
