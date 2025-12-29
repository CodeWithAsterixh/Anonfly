import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { Types } from 'mongoose';

const editChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'patch',
  path: '/chatrooms/:id',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { id: chatroomId } = params;
    const userAid = (req as any)?.userAid;

    if (!userAid) {
      return { message: 'User not authenticated', statusCode: 401, success: false, status: 'bad' };
    }

    if (!chatroomId || !Types.ObjectId.isValid(chatroomId)) {
      return { message: 'Invalid chatroom ID', statusCode: 400, success: false, status: 'bad' };
    }

    const { roomname, description } = req.body || {};

    if (!roomname && (description === undefined || description === null)) {
      return { message: 'Nothing to update', statusCode: 400, success: false, status: 'bad' };
    }

    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom) {
      return { message: 'Chatroom not found', statusCode: 404, success: false, status: 'bad' };
    }

    // Only the host can edit chatroom details
    if (chatroom.hostAid !== userAid) {
      return { message: 'Only the host can edit chatroom details', statusCode: 403, success: false, status: 'bad' };
    }

    // Validate roomname uniqueness if changed
    if (roomname && roomname !== chatroom.roomname) {
      const existing = await ChatRoom.findOne({ roomname });
      if (existing) {
        return { message: 'Room name already in use', statusCode: 409, success: false, status: 'bad' };
      }
      chatroom.roomname = roomname;
    }

    if (description !== undefined && description !== null) {
      chatroom.description = description;
    }

    await chatroom.save();

    // Emit event for real-time updates
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');

    return {
      message: 'Chatroom updated',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { chatroomId: chatroom._id, roomname: chatroom.roomname, description: chatroom.description },
    };
  }),
};

export default editChatroomRoute;
