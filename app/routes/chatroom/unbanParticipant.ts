import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import { FEATURES } from '../../../lib/constants/features';
import { getPermissionsByUserId } from '../../../lib/helpers/permissionHelper';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';

const unbanParticipantRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:chatroomId/participants/:userAid/unban',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params } = event;
    const { chatroomId, userAid: targetUserAid } = params;
    const requesterAid = (req as any)?.userAid;

    if (!requesterAid) {
      return {
        message: 'User not authenticated',
        statusCode: 401,
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

    // 1. Only the room creator can unban
    if (chatroom.creatorAid !== requesterAid) {
      return {
        message: 'Unauthorized: Only the room creator can unban participants',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // 2. Premium feature check
    const permission = await getPermissionsByUserId(requesterAid);
    if (!permission || !permission.allowedFeatures.includes(FEATURES.BAN_USER)) {
      return {
        message: 'Premium feature: Upgrade to unban participants.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // 3. Remove from bans
    const initialBanCount = chatroom.bans.length;
    chatroom.bans = chatroom.bans.filter(b => b.userAid !== targetUserAid);

    if (chatroom.bans.length === initialBanCount) {
      return {
        message: 'User is not banned',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    await chatroom.save();

    // 4. Emit events for real-time updates
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);

    return {
      message: 'Participant unbanned successfully',
      statusCode: 200,
      success: true,
      status: 'good',
    };
  }),
};

export default unbanParticipantRoute;
