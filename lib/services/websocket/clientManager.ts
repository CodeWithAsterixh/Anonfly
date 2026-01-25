import { CustomWebSocket } from '../../types/websocket';
import ChatRoom from '../../models/chatRoom';
import chatEventEmitter from '../../helpers/eventEmitter';
import cleanupChatroom from '../../helpers/cleanupChatroom';
import pino from 'pino';
import env from '../../constants/env';
import { WebSocket } from 'ws';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export const clients = new Map<string, CustomWebSocket>();
export const activeChatrooms = new Map<string, Map<string, CustomWebSocket>>(); 
const chatroomCleanupTimeouts = new Map<string, NodeJS.Timeout>();

export function addClientToChatroom(chatroomId: string, ws: CustomWebSocket) {
  if (!activeChatrooms.has(chatroomId)) {
    activeChatrooms.set(chatroomId, new Map<string, CustomWebSocket>());
  }
  activeChatrooms.get(chatroomId)?.set(ws.id, ws);
  ws.chatroomId = chatroomId;
  logger.info(`Client ${ws.id} added to chatroom ${chatroomId}. Total clients in room: ${activeChatrooms.get(chatroomId)?.size}`);

  const existingTimeout = chatroomCleanupTimeouts.get(chatroomId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    chatroomCleanupTimeouts.delete(chatroomId);
    logger.info(`Cleared cleanup timeout for chatroom ${chatroomId} as a user joined`);
  }
}

export function forceDisconnectClient(chatroomId: string, userAid: string, reason: 'removed' | 'banned') {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
    for (const [wsId, ws] of chatroomClients) {
      if (ws.userAid === userAid) {
        ws.send(JSON.stringify({ 
          type: 'forceDisconnect', 
          reason,
          message: reason === 'banned' 
            ? 'You were banned from this room and cannot rejoin.' 
            : 'You were removed from the room by the moderator.'
        }));
        
        broadcastUserLeft(chatroomId, ws.userAid, ws.username || 'Unknown', false);

        chatroomClients.delete(wsId);
        ws.chatroomId = undefined;
        logger.info(`Force disconnected client ${userAid} from room ${chatroomId} for ${reason}`);
      }
    }
  }
}

export function broadcastHostUpdate(chatroomId: string, hostAid: string) {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
    const hostUpdate = JSON.stringify({
      type: 'hostUpdated',
      chatroomId: chatroomId,
      hostAid: hostAid
    });
    chatroomClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(hostUpdate);
      }
    });
  }
}

export async function removeClientFromChatroom(chatroomId: string, ws: CustomWebSocket) {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (!chatroomClients) return;

  chatroomClients.delete(ws.id);
  
  if (ws.userAid) {
    await handleParticipantRemoval(chatroomId, ws.userAid);
  }

  if (chatroomClients.size === 0) {
    handleEmptyChatroom(chatroomId);
  }
  
  delete ws.chatroomId;
  logger.info(`Client ${ws.id} removed from chatroom ${chatroomId}. Total clients in room: ${activeChatrooms.get(chatroomId)?.size || 0}`);

  if (ws.userAid) {
    await broadcastUserLeftWithCreatorCheck(chatroomId, ws.userAid, ws.username || 'Unknown', ws.id);
  }
}

async function handleParticipantRemoval(chatroomId: string, userAid: string) {
  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom) return;

    const participantIndex = chatroom.participants.findIndex(p => p.userAid === userAid);
    if (participantIndex !== -1) {
      if (chatroom.hostAid === userAid) {
        transferHostStatus(chatroom, userAid, participantIndex);
      }

      chatroom.participants.splice(participantIndex, 1);
      await chatroom.save();
      chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
      logger.info(`Removed participant ${userAid} from chatroom ${chatroomId} due to disconnect`);
    }
  } catch (err) {
    logger.error(`Error removing participant on disconnect: ${err}`);
  }
}

function transferHostStatus(chatroom: any, oldHostAid: string, participantIndex: number) {
  const remainingParticipants = chatroom.participants.filter((_: any, index: number) => index !== participantIndex);
  
  if (remainingParticipants.length > 0) {
    const newHost = remainingParticipants.reduce((prev: any, curr: any) => {
      const prevDate = prev.joinedAt ? new Date(prev.joinedAt).getTime() : Infinity;
      const currDate = curr.joinedAt ? new Date(curr.joinedAt).getTime() : Infinity;
      return prevDate < currDate ? prev : curr;
    }, remainingParticipants[0]);
    
    chatroom.hostAid = newHost.userAid;
    logger.info(`Host status transferred to ${newHost.userAid} in chatroom ${chatroom._id} after disconnect`);
    
    broadcastHostUpdate(chatroom._id.toString(), chatroom.hostAid);
  } else {
    chatroom.hostAid = ""; 
  }
}

function handleEmptyChatroom(chatroomId: string) {
  activeChatrooms.delete(chatroomId);
  const timeout = setTimeout(async () => {
    try {
      const chatroom = await ChatRoom.findById(chatroomId);
      if (chatroom && chatroom.participants.length === 0) {
        await cleanupChatroom(chatroomId);
        logger.info(`Chatroom ${chatroomId} deleted after 24 hours of inactivity`);
      }
      chatroomCleanupTimeouts.delete(chatroomId);
    } catch (err) {
      logger.error(`Error in delayed chatroom cleanup for ${chatroomId}: ${err}`);
    }
  }, 24 * 60 * 60 * 1000); 

  chatroomCleanupTimeouts.set(chatroomId, timeout);
  logger.info(`Started 24-hour cleanup timeout for chatroom ${chatroomId}`);
}

async function broadcastUserLeftWithCreatorCheck(chatroomId: string, userAid: string, username: string, excludeWsId: string) {
  try {
    const remaining = activeChatrooms.get(chatroomId);
    if (remaining) {
      const chatroom = await ChatRoom.findById(chatroomId);
      const isCreatorLeaving = chatroom?.creatorAid === userAid;
      
      const leaveNotice = JSON.stringify({
        type: 'userLeft',
        chatroomId,
        userAid,
        username,
        timestamp: new Date().toISOString(),
        isCreator: isCreatorLeaving
      });
      
      remaining.forEach(client => {
        if (client.id === excludeWsId) return; 
        if (client.readyState === WebSocket.OPEN) {
          client.send(leaveNotice);
        }
      });
    }
  } catch (err) {
    logger.error(`Failed to broadcast userLeft for ${userAid}: ${err}`);
  }
}

function broadcastUserLeft(chatroomId: string, userAid: string, username: string, isCreator: boolean) {
    const chatroomClients = activeChatrooms.get(chatroomId);
    if (!chatroomClients) return;
    
    const leaveNotice = JSON.stringify({
      type: 'userLeft',
      chatroomId,
      userAid,
      username,
      timestamp: new Date().toISOString(),
      isCreator
    });

    chatroomClients.forEach(client => {
      if (client.userAid !== userAid && client.readyState === WebSocket.OPEN) {
        client.send(leaveNotice);
      }
    });
}

export async function handleExplicitLeave(chatroomId: string, ws: CustomWebSocket) {
  try {
    if (!ws.userAid) return;
    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom) return;

    const participantIndex = chatroom.participants.findIndex(p => p.userAid === ws.userAid);
    if (participantIndex === -1) return;

    if (chatroom.hostAid === ws.userAid) {
      transferHostStatus(chatroom, ws.userAid, participantIndex);
    }

    chatroom.participants.splice(participantIndex, 1);

    await chatroom.save();
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');
    logger.info(`Removed participant ${ws.userAid} from chatroom ${chatroomId} in DB (explicit leave)`);
  } catch (err) {
    logger.error(`Error handling explicit leave for participant ${ws.userAid} in chatroom ${chatroomId}: ${err}`);
  }
}
