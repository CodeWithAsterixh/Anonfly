import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import { checkPermission } from '../../../lib/middlewares/checkPermission';
import { FEATURES } from '../../../lib/constants/features';
import { getPermissionsByUserId } from '../../../lib/helpers/permissionHelper';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';

const removeParticipantRoute: Omit<RouteConfig, 'app'> = {
  method: 'delete',
  path: '/chatrooms/:chatroomId/participants/:userAid',
  middleware: [verifyToken], // Basic token verification first
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

    // 1. Check if the requester is the host
    if (chatroom.hostAid !== requesterAid) {
      return {
        message: 'Unauthorized: Only the host can remove participants',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // 2. Perform the feature gating check
    const permission = await getPermissionsByUserId(requesterAid);
    
    if (!permission || !permission.allowedFeatures.includes(FEATURES.REMOVE_USER)) {
      return {
        message: 'Permission denied: Upgrade to premium to remove participants.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // Check if permissions have expired (e.g., if we tie expiry to a plan subscription)
    if (permission.tokenExpiresAt && new Date() > permission.tokenExpiresAt) {
      return {
        message: 'Your feature access has expired. Please renew your plan.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // 3. Prevent host from removing themselves
    if (targetUserAid === chatroom.hostAid) {
      return {
        message: 'Cannot remove the host from the room',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    // 4. Find and remove the participant
    const participantIndex = chatroom.participants.findIndex(p => p.userAid === targetUserAid);

    if (participantIndex === -1) {
      return {
        message: 'Participant not found in this chatroom',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    chatroom.participants.splice(participantIndex, 1);
    await chatroom.save();

    // Emit event for real-time updates
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');

    return {
      message: 'Participant removed successfully',
      statusCode: 200,
      success: true,
      status: 'good',
    };
  }),
};

export default removeParticipantRoute;
