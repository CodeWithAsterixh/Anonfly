import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import { FEATURES } from '../../../lib/constants/features';
import { getPermissionsByUserId } from '../../../lib/helpers/permissionHelper';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { forceDisconnectClient, broadcastHostUpdate } from '../../../lib/services/websocket/clientManager';

const banParticipantRoute: Omit<RouteConfig, 'app'> = {
  method: 'post',
  path: '/chatrooms/:chatroomId/participants/:userAid/ban',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { req, params, body } = event;
    const { chatroomId, userAid: targetUserAid } = params;
    const { reason } = body as { reason?: string };
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

    // 1. Restrict ban feature strictly to the room creator, not hosts.
    if (chatroom.creatorAid !== requesterAid) {
      return {
        message: 'Unauthorized: Only the room creator can ban participants',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // 2. Premium feature check
    const permission = await getPermissionsByUserId(requesterAid);
    if (!permission || !permission.allowedFeatures.includes(FEATURES.BAN_USER)) {
      return {
        message: 'Premium feature: Upgrade to ban participants.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    if (permission.tokenExpiresAt && new Date() > permission.tokenExpiresAt) {
      return {
        message: 'Your premium plan has expired. Please renew to use ban features.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // 3. Prevent creator from banning themselves
    if (targetUserAid === chatroom.creatorAid) {
      return {
        message: 'Cannot ban yourself',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    // 4. Check if already banned
    const alreadyBanned = chatroom.bans.some(b => b.userAid === targetUserAid);
    if (alreadyBanned) {
      return {
        message: 'User is already banned',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    // 5. Find participant to get their username
    const participant = chatroom.participants.find(p => p.userAid === targetUserAid);
    const username = participant?.username || 'Unknown User';

    // 6. Add to bans
    chatroom.bans.push({
      userAid: targetUserAid,
      username,
      bannedAt: new Date(),
      reason
    });

    // 7. Mark as left if they are in the room
    if (participant) {
      participant.leftAt = new Date();
    }

    // 7.5 If the banned user was the host, transfer host status back to the creator
    if (chatroom.hostAid === targetUserAid) {
      chatroom.hostAid = chatroom.creatorAid;
      broadcastHostUpdate(chatroomId, chatroom.hostAid);
    }

    await chatroom.save();

    // 8. Force disconnect the user via WebSocket
    forceDisconnectClient(chatroomId, targetUserAid, 'banned');

    // 9. Emit events for real-time updates
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');
    chatEventEmitter.emit(`userRemoved:${chatroomId}`, { chatroomId, userAid: targetUserAid });

    return {
      message: 'Participant banned successfully',
      statusCode: 200,
      success: true,
      status: 'good',
    };
  }),
};

export default banParticipantRoute;
