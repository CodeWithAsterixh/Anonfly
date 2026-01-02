import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import bcrypt from 'bcrypt';
import { getPermissionsByUserId } from '../../../lib/helpers/permissionHelper';

import { validate, chatroomSchema } from '../../../lib/helpers/validation';
import { rateLimiter } from '../../../lib/middlewares/rateLimiter';

const createChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms',
  middleware: [verifyToken, validate(chatroomSchema), rateLimiter(5, 60 * 60 * 1000)], // Limit to 5 rooms per hour
  handler: withErrorHandling(async (event) => {
    const { body, req } = event;
    const { roomname, description, password, region } = body as { 
      roomname: string; 
      description?: string; 
      password?: string;
      region?: string;
    };

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
      // Ensure host has permission record
      await getPermissionsByUserId(hostAid);

      let hashedPassword;
      let isLocked = false;

      if (password && password.trim() !== '') {
        hashedPassword = await bcrypt.hash(password, 10);
        isLocked = true;
      }

      const newChatRoom = new ChatRoom({
        roomname,
        description,
        region,
        hostAid,
        password: hashedPassword,
        isLocked,
        participants: [], // Don't add host as participant until they connect via WS
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