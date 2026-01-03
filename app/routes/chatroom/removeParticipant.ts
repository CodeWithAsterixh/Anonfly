import ChatRoom from '../../../lib/models/chatRoom';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import chatEventEmitter from '../../../lib/helpers/eventEmitter';
import { forceDisconnectClient, broadcastHostUpdate } from '../../../lib/services/websocket/clientManager';

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

    // Check if the requester is the host or creator
    const isAuthorized = chatroom.hostAid === requesterAid || chatroom.creatorAid === requesterAid;
    if (!isAuthorized) {
      return {
        message: 'Unauthorized: Only the host or creator can remove participants',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // Prevent removing the creator
    if (targetUserAid === chatroom.creatorAid) {
      return {
        message: 'Cannot remove the room creator',
        statusCode: 400,
        success: false,
        status: 'bad',
      };
    }

    // Find and mark the participant as left
    const participant = chatroom.participants.find(p => p.userAid === targetUserAid);

    if (!participant) {
      return {
        message: 'Participant not found in this chatroom',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    participant.leftAt = new Date();
    
    // If the removed user was the host, transfer host status back to the creator
    if (chatroom.hostAid === targetUserAid) {
      chatroom.hostAid = chatroom.creatorAid;
      broadcastHostUpdate(chatroomId, chatroom.hostAid);
    }

    await chatroom.save();

    // Force disconnect the user via WebSocket
    forceDisconnectClient(chatroomId, targetUserAid, 'removed');

    // Emit events for real-time updates
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');
    chatEventEmitter.emit(`userRemoved:${chatroomId}`, { chatroomId, userAid: targetUserAid });
    
    return {
      message: 'Participant removed successfully',
      statusCode: 200,
      success: true,
      status: 'good',
    };
  }),
};

export default removeParticipantRoute;
