import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import bcrypt from 'bcrypt';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { validateRoomAccessToken, validateJoinAuthToken } from '../../../lib/helpers/crypto';

import { validate, joinChatroomSchema } from '../../../lib/helpers/validation';

const joinChatroomRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/join',
  middleware: [verifyToken, validate(joinChatroomSchema)],
  handler: withErrorHandling(async (event) => {
    const { req, params, body } = event;
    const { id: chatroomId } = params;
    const { password, linkToken, joinAuthToken } = body as { password?: string, linkToken?: string, joinAuthToken?: string };
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
    const isCreator = userAid === chatroom.creatorAid;
    let isTokenValid = false;

    // 1. Check joinAuthToken (short-lived proof from validate-link)
    if (joinAuthToken && !isCreator && !isParticipant) {
      if (validateJoinAuthToken(joinAuthToken, chatroomId, userAid)) {
        isTokenValid = true;
      }
    }

    // 2. Link token validation (the long-lived invite link itself)
    if (!isTokenValid && linkToken && !isCreator && !isParticipant) {
      try {
        const decoded = validateRoomAccessToken(linkToken);
        if (decoded.roomId === chatroomId) {
          // A match is either direct (both are hashes) or via bcrypt (one is raw, one is hash)
          const roomPwd = chatroom.password || null;
          const tokenPwd = decoded.password || null;
          
          let isMatch = roomPwd === tokenPwd;
          if (!isMatch && roomPwd && tokenPwd) {
            try {
              isMatch = await bcrypt.compare(tokenPwd, roomPwd);
            } catch (e) {
              isMatch = false;
            }
          }

          if (!roomPwd || isMatch) {
            isTokenValid = true;
          }
        }
      } catch (err) {
        // Token invalid or expired, will fall back to other checks if needed
      }
    }

    // Private room access control
    if (chatroom.isPrivate && !isParticipant && !isCreator && !isTokenValid) {
      return {
        message: 'This is a private room. Access is only allowed via a secure invite link.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
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
    // Allow if user is creator, already a participant, or has a valid link token
    if (chatroom.isLocked && chatroom.password && !isCreator && !isParticipant && !isTokenValid) {
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
