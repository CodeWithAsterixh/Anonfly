import ChatRoom from '../../../lib/models/chatRoom.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import { verifyToken } from '../../../lib/middlewares/verifyToken.ts';
import { Types } from 'mongoose';

const leaveChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/leave',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { id: chatroomId } = params;
    const userId = (req.user as any)?._id;

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

    const participantIndex = chatroom.participants.findIndex(p => p.userId.toString() === userId.toString());

    if (participantIndex === -1) {
      return {
        message: 'User is not a participant in this chatroom',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    // Remove user from participants list
    chatroom.participants.splice(participantIndex, 1);

    // If the leaving user is the host, transfer host status
    if (chatroom.hostUserId.toString() === userId.toString()) {
      if (chatroom.participants.length > 0) {
        // Find participant with the closest timestamp to be the new host
        const newHost = chatroom.participants.reduce((prev, curr) => {
          return (prev.joinedAt && curr.joinedAt && prev.joinedAt.getTime() < curr.joinedAt.getTime()) ? prev : curr;
        }, chatroom.participants[0]);
        chatroom.hostUserId = new Types.ObjectId(newHost.userId);
      } else {
        // If no participants left, delete the chatroom
        await ChatRoom.deleteOne({ _id: chatroomId });
        return {
          message: 'Chatroom left and deleted as no participants remain',
          statusCode: 200,
          success: true,
          status: 'good',
        };
      }
    }

    await chatroom.save();

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
