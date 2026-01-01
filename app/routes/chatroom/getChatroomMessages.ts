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
    const isHost = chatroom.hostAid === userAid;
    const currentParticipant = chatroom.participants.find(p => p.userAid === userAid);
    const joinedAt = currentParticipant?.joinedAt ? new Date(currentParticipant.joinedAt).getTime() : 0;

    let messages = chatroom.messages;
    if (!isHost && joinedAt > 0) {
      messages = messages.filter(msg => new Date(msg.timestamp).getTime() >= joinedAt);
    }

    return {
      statusCode: 200,
      success: true,
      status: 'good',
      data: messages,
    };
  }),
};

export default getChatroomMessagesRoute;
