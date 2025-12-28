import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';

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

    // Assuming req.userAid is populated by authentication middleware
    const hostAid = (req as any)?.userAid;
    const username = (req as any)?.username;

    if (!hostAid) {
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
        hostAid,
        participants: [{ 
          userAid: hostAid, 
          username,
          publicKey: (req as any).session?.publicKey,
          exchangePublicKey: (req as any).session?.exchangePublicKey
        }], // Add host as participant
      });

      await newChatRoom.save();

      // Emit event that a new chatroom has been created
      chatEventEmitter.emit('chatroomCreated', newChatRoom);

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