import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import bcrypt from 'bcrypt';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { validateRoomAccessToken } from '../../../lib/helpers/crypto';

import { validate, joinChatroomSchema } from '../../../lib/helpers/validation';

const joinChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/join',
  middleware: [verifyToken, validate(joinChatroomSchema)],
  handler: withErrorHandling(async (event) => {
    const { req, params, body } = event;
    const { id: chatroomId } = params;
    const { password, linkToken } = body as { password?: string, linkToken?: string };
    const userAid = (req as any)?.userAid;
    const username = (req as any)?.username;

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

    // Check if user is banned
    const isBanned = chatroom.bans?.some(b => b.userAid === userAid);
    if (isBanned) {
      return {
        message: 'You were banned from this room and cannot rejoin.',
        statusCode: 403,
        success: false,
        status: 'bad',
        reason: 'banned'
      };
    }

    // Check if user is already a participant
    const isParticipant = chatroom.participants.some(p => p.userAid === userAid);

    // Private room access control
    if (chatroom.isPrivate && !isParticipant) {
      if (!linkToken) {
        return {
          message: 'This is a private room. Access is only allowed via a secure invite link.',
          statusCode: 403,
          success: false,
          status: 'bad',
        };
      }

      try {
        const decoded = validateRoomAccessToken(linkToken);
        if (decoded.roomId !== chatroomId) {
          throw new Error('Invalid token for this room');
        }
        // If it's a private room, the linkToken must also contain the correct password hash
        if (chatroom.password && decoded.password !== chatroom.password) {
          throw new Error('Invalid access token');
        }
      } catch (err: any) {
        return {
          message: 'Invalid or expired invite link.',
          statusCode: 403,
          success: false,
          status: 'bad',
        };
      }
    }

    if (isParticipant) {
      return {
        message: 'User is already a participant in this chatroom',
        statusCode: 200, // Return 200 instead of 409 to allow re-joining/accessing details
        success: true,
        status: 'good',
        data: { chatroomId: chatroom._id, roomname: chatroom.roomname },
      };
    }

    // Password verification for locked rooms
    if (chatroom.isLocked && chatroom.password) {
      if (!password) {
        return {
          message: 'Password required for this chatroom',
          statusCode: 403,
          success: false,
          status: 'bad',
          requiresPassword: true
        };
      }

      const isMatch = await bcrypt.compare(password, chatroom.password);
      if (!isMatch) {
        return {
          message: 'Incorrect password',
          statusCode: 403,
          success: false,
          status: 'bad',
        };
      }
    }

    // We no longer add participants here. They are added when they connect via WebSocket.
    // This route now primarily serves for password verification and existence check.
    
    // Emit event for real-time updates (optional since no data changed, but good for consistency)
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');

    return {
      message: 'Successfully joined chatroom',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { chatroomId: chatroom._id, roomname: chatroom.roomname },
    };
  }),
};

export default joinChatroomRoute;
