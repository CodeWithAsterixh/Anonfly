import ChatRoom from '../../../lib/models/chatRoom.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import { verifyToken } from '../../../lib/middlewares/verifyToken.ts';

const createChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { body, req } = event;
    const { roomname, description } = body as { roomname: string; description?: string };

    if (!roomname) {
      return {
        message: 'Room name is required',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    // Assuming req.user is populated by authentication middleware
    const hostUserId = (req.user as any)?._id;

    if (!hostUserId) {
      return {
        message: 'User not authenticated',
        statusCode: 401,
        success: false,
        status: 'bad',
      };
    }

    try {
      const newChatRoom = new ChatRoom({
        roomname,
        description,
        hostUserId,
        participants: [{ userId: hostUserId, username: (req.user as any)?.username }], // Add host as participant
      });

      await newChatRoom.save();

      return {
        message: 'Chatroom created successfully',
        statusCode: 201,
        success: true,
        status: 'good',
        data: { id: newChatRoom._id, roomname: newChatRoom.roomname },
      };
    } catch (error: any) {
      if (error.code === 11000) { // Duplicate key error for unique roomname
        return {
          message: 'Chatroom with this name already exists',
          statusCode: 409,
          success: false,
          status: 'bad',
        };
      }
      throw error; // Re-throw other errors for withErrorHandling to catch
    }
  }),
};

export default createChatroomRoute;