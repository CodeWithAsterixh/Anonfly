import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { GeneralResponse, RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import bcrypt from 'bcrypt';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { validateRoomAccessToken, validateJoinAuthToken } from '../../../lib/helpers/crypto';

import { validate, joinChatroomSchema } from '../../../lib/helpers/validation';

/**
 * Route configuration for joining a chatroom.
 * 
 * POST /chatrooms/:id/join
 * 
 * This route validates access requirements for a chatroom:
 * 1. Checks if the user is banned.
 * 2. Checks if the user is already a participant.
 * 3. Validates passwords for locked rooms.
 * 4. Validates invite tokens for private rooms.
 * 
 * NOTE: This route does NOT add the user to the `participants` array in the DB.
 * That is handled by the WebSocket `joinChatroom` handler when the client connects.
 * 
 * Middleware:
 * - `verifyToken`: Ensures user is authenticated.
 * - `validate(joinChatroomSchema)`: Validates request body (password, tokens).
 */
const isUserBanned = (chatroom: any, userAid: string) => {
  return chatroom.bans?.some((b: any) => b.userAid === userAid);
};

const validateAccessTokens = async (
  chatroom: any,
  userAid: string,
  linkToken?: string,
  joinAuthToken?: string
): Promise<boolean> => {
  const chatroomId = chatroom._id.toString();

  // 1. Check joinAuthToken
  if (joinAuthToken) {
    if (validateJoinAuthToken(joinAuthToken, chatroomId, userAid)) {
      return true;
    }
  }

  // 2. Link token validation
  if (linkToken) {
    try {
      const decoded = validateRoomAccessToken(linkToken);
      if (decoded.roomId === chatroomId) {
        const roomPwd = chatroom.password || null;
        const tokenPwd = decoded.password || null;

        let isMatch = roomPwd === tokenPwd;
        if (!isMatch && roomPwd && tokenPwd) {
          isMatch = await bcrypt.compare(tokenPwd, roomPwd).catch(() => false);
        }

        if (!roomPwd || isMatch) {
          return true;
        }
      }
    } catch {
      // Token invalid or expired
    }
  }
  return false;
};

const verifyLockedRoomPassword = async (chatroom: any, password?: string) => {
  if (!password) {
    return {
      message: 'Password required for this chatroom',
      statusCode: 403,
      success: false,
      status: 'bad' as GeneralResponse['status'],
      requiresPassword: true
    };
  }

  const isMatch = await bcrypt.compare(password, chatroom.password);
  if (!isMatch) {
    return {
      message: 'Incorrect password',
      statusCode: 403,
      success: false,
      status: 'bad' as GeneralResponse['status'],
    };
  }
  return null;
};

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
    if (isUserBanned(chatroom, userAid)) {
      return {
        message: 'You were banned from this room and cannot rejoin.',
        statusCode: 403,
        success: false,
        status: 'bad',
        reason: 'banned'
      };
    }

    // Check if user is already a participant
    const isParticipant = chatroom.participants.some((p: any) => p.userAid === userAid);
    const isCreator = userAid === chatroom.creatorAid;
    
    let isTokenValid = false;
    if (!isCreator && !isParticipant) {
      isTokenValid = await validateAccessTokens(chatroom, userAid, linkToken, joinAuthToken);
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
      const passwordError = await verifyLockedRoomPassword(chatroom, password);
      if (passwordError) {
        return passwordError;
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
