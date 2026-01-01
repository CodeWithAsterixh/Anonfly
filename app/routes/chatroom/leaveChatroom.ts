import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { Types } from 'mongoose';

const leaveChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/leave',
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

    const participant = chatroom.participants.find(p => p.userAid === userAid);

    if (!participant) {
      return {
        message: 'User is not a participant in this chatroom',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    // Mark user as left in participants list
    participant.leftAt = new Date();

    // If the leaving user is the host, transfer host status if possible
    if (chatroom.hostAid === userAid) {
      const remainingParticipants = chatroom.participants.filter(p => !p.leftAt);
      if (remainingParticipants.length > 0) {
        // Find participant with the closest timestamp to be the new host
        const newHost = remainingParticipants.reduce((prev, curr) => {
          return (prev.joinedAt && curr.joinedAt && prev.joinedAt.getTime() < curr.joinedAt.getTime()) ? prev : curr;
        }, remainingParticipants[0]);
        chatroom.hostAid = newHost.userAid;
      } else {
        // If no participants left, preserve the room for a while
        // The background cleanup job or websocket cleanup will handle deletion
        await chatroom.save();
        return {
          message: 'Successfully left chatroom. Room is preserved while empty.',
          statusCode: 200,
          success: true,
          status: 'good',
        };
      }
    }

    await chatroom.save();

    // Emit event for real-time updates
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');

    return {
      message: 'Successfully left chatroom',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { chatroomId: chatroom._id, roomname: chatroom.roomname },
    };
  }),
};

export default leaveChatroomRoute;
