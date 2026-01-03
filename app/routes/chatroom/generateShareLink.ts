import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import { generateRoomAccessToken } from '../../../lib/helpers/crypto';
import { Types } from 'mongoose';

const generateShareLinkRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:id/share-link',
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

    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom) {
      return { message: 'Chatroom not found', statusCode: 404, success: false, status: 'bad' };
    }

    // Only the host can generate a share link (which may contain sensitive info like the room password)
    if (chatroom.hostAid !== userAid) {
      return { message: 'Only the host can generate share links', statusCode: 403, success: false, status: 'bad' };
    }

    // Generate token containing roomId and potential room password
    // We use the raw password if it exists (for encrypted rooms)
    // For free rooms, we still generate a token for consistency and security
    const { token, expiresAt } = generateRoomAccessToken(chatroom._id.toString(), chatroom.password);

    return {
      message: 'Share link generated successfully',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { token, expiresAt },
    };
  }),
};

export default generateShareLinkRoute;
