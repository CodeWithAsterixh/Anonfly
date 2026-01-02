import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import { validateRoomAccessToken } from '../../../lib/helpers/crypto';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';

const validateShareLinkRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/validate-link',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req } = event;
    const { token } = req.body;
    const userAid = (req as any)?.userAid;

    if (!userAid) {
      return { message: 'User not authenticated', statusCode: 401, success: false, status: 'bad' };
    }

    if (!token) {
      return { message: 'Access token is required', statusCode: 400, success: false, status: 'bad' };
    }

    try {
      let roomId, password;
      try {
        const decoded = validateRoomAccessToken(token);
        roomId = decoded.roomId;
        password = decoded.password;
      } catch (err) {
        console.error('[validateShareLink] Token validation failed:', err);
        return { message: 'Invalid or expired access link', statusCode: 401, success: false, status: 'bad' };
      }

      if (!roomId || !Types.ObjectId.isValid(roomId)) {
        console.error('[validateShareLink] Invalid roomId in token:', roomId);
        return { message: 'Invalid token payload', statusCode: 400, success: false, status: 'bad' };
      }

      const chatroom = await ChatRoom.findById(roomId);
      if (!chatroom) {
        console.error('[validateShareLink] Chatroom not found:', roomId);
        return { message: 'Chatroom not found', statusCode: 404, success: false, status: 'bad' };
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

      // If the room has a password, the token MUST contain the correct hashed password
      // For free rooms, the password in the token will be null/undefined
      const isParticipant = chatroom.participants.some(p => p.userAid === userAid);
      const isCreator = chatroom.creatorAid === userAid;

      // Robust comparison handling null vs undefined
      const roomPwd = chatroom.password || null;
      const tokenPwd = password || null;

      // A match is either direct (both are hashes) or via bcrypt (one is raw, one is hash)
      let isMatch = roomPwd === tokenPwd;
      
      // If not a direct match and we have both, try bcrypt.compare
      // This handles cases where the token might contain a raw password
      if (!isMatch && roomPwd && tokenPwd) {
        try {
          isMatch = await bcrypt.compare(tokenPwd, roomPwd);
        } catch (e) {
          // bcrypt.compare might fail if tokenPwd is not a valid string or if roomPwd is not a valid hash
          isMatch = false;
        }
      }

      if (chatroom.isLocked && !isMatch && !isParticipant && !isCreator) {
        console.error('[validateShareLink] Password mismatch for room:', roomId, { 
          hasRoomPassword: !!roomPwd, 
          hasTokenPassword: !!tokenPwd,
          isParticipant,
          isCreator
        });
        return { message: 'Invalid access token for this room', statusCode: 403, success: false, status: 'bad' };
      }

      return {
        message: 'Link validated successfully',
        statusCode: 200,
        success: true,
        status: 'good',
        data: {
          chatroomId: chatroom._id,
          roomname: chatroom.roomname,
          isLocked: chatroom.isLocked,
          password: chatroom.isLocked ? password : undefined,
          accessGranted: true
        },
      };
    } catch (err: any) {
      return {
        message: err.message || 'Invalid or expired access link',
        statusCode: 401,
        success: false,
        status: 'bad',
      };
    }
  }),
};

export default validateShareLinkRoute;
