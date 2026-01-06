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

    const participantIndex = chatroom.participants.findIndex(p => p.userAid === userAid);

    if (participantIndex === -1) {
      return {
        message: 'User is not a participant in this chatroom',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    // If the leaving user is the host, transfer host status if possible
    if (chatroom.hostAid === userAid) {
      const remainingParticipants = chatroom.participants.filter((_, index) => index !== participantIndex);
      if (remainingParticipants.length > 0) {
        // Find participant with the earliest joinedAt to be the new host
        const newHost = remainingParticipants.reduce((prev, curr) => {
          const prevTime = prev.joinedAt ? new Date(prev.joinedAt).getTime() : Infinity;
          const currTime = curr.joinedAt ? new Date(curr.joinedAt).getTime() : Infinity;
          return prevTime < currTime ? prev : curr;
        }, remainingParticipants[0]);
        chatroom.hostAid = newHost.userAid;
      } else {
        chatroom.hostAid = ""; 
      }
    }

    // Remove the participant from the list
    chatroom.participants.splice(participantIndex, 1);

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
