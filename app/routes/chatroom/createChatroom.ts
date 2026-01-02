import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import bcrypt from 'bcrypt';
import { getPermissionsByUserId } from '../../../lib/helpers/permissionHelper';
import { FEATURES } from '../../../lib/constants/features';
import crypto from 'crypto';

import { validate, chatroomSchema } from '../../../lib/helpers/validation';
import { createRoomLimiter } from '../../../lib/middlewares/rateLimiter';
import { generateRoomAccessToken } from '../../../lib/helpers/crypto';

const createChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms',
  middleware: [verifyToken, validate(chatroomSchema), createRoomLimiter], // Limit to 5 rooms per hour
  handler: withErrorHandling(async (event) => {
    const { body, req } = event;
    const { roomname, description, password, region, isPrivate } = body as { 
      roomname: string; 
      description?: string; 
      password?: string;
      region?: string;
      isPrivate?: boolean;
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
      const permissions = await getPermissionsByUserId(hostAid);

      let hashedPassword;
      let isLocked = false;
      let finalIsPrivate = false;

      // Handle private room logic
      if (isPrivate) {
        // Verify premium status for private rooms
        if (!permissions || !permissions.allowedFeatures.includes(FEATURES.CREATE_PRIVATE_ROOM)) {
          return {
            message: 'Premium feature: Upgrade to create private rooms.',
            statusCode: 403,
            success: false,
            status: 'bad',
          };
        }

        if (permissions.tokenExpiresAt && new Date() > permissions.tokenExpiresAt) {
          return {
            message: 'Your premium plan has expired. Please renew to create private rooms.',
            statusCode: 403,
            success: false,
            status: 'bad',
          };
        }

        finalIsPrivate = true;
        isLocked = true; // Private rooms are always locked
        
        // If no password provided for private room, generate one
        const effectivePassword = password || crypto.randomBytes(16).toString('hex');
        hashedPassword = await bcrypt.hash(effectivePassword, 10);
      } else if (password && password.trim() !== '') {
        hashedPassword = await bcrypt.hash(password, 10);
        isLocked = true;
      }

      const newChatRoom = new ChatRoom({
        roomname,
        description,
        region,
        hostAid,
        creatorAid: hostAid,
        password: hashedPassword,
        isLocked,
        isPrivate: finalIsPrivate,
        participants: [], // Don't add host as participant until they connect via WS
      });

      await newChatRoom.save();

      // Emit event that a new chatroom has been created
      chatEventEmitter.emit('chatroomCreated', newChatRoom);

      // Generate token if it's a private room
      let token;
      if (newChatRoom.isPrivate) {
        token = generateRoomAccessToken(newChatRoom._id.toString(), newChatRoom.password);
      }

      return {
        message: 'Chatroom created successfully',
        statusCode: 201,
        success: true,
        status: 'good',
        data: { 
          id: newChatRoom._id, 
          roomname: newChatRoom.roomname,
          isPrivate: newChatRoom.isPrivate,
          token
        },
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