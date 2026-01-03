import { CustomWebSocket } from '../../types/websocket';
import ChatRoom from '../../models/chatRoom';
import chatEventEmitter from '../../helpers/eventEmitter';
import cleanupChatroom from '../../helpers/cleanupChatroom';
import pino from 'pino';
import env from '../../constants/env';
import { WebSocket } from 'ws';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export const clients = new Map<string, CustomWebSocket>();
export const activeChatrooms = new Map<string, Map<string, CustomWebSocket>>(); // chatroomId -> Map<wsId, CustomWebSocket>

const chatroomCleanupTimeouts = new Map<string, NodeJS.Timeout>();

export function addClientToChatroom(chatroomId: string, ws: CustomWebSocket) {
  if (!activeChatrooms.has(chatroomId)) {
    activeChatrooms.set(chatroomId, new Map<string, CustomWebSocket>());
  }
  activeChatrooms.get(chatroomId)?.set(ws.id, ws);
  ws.chatroomId = chatroomId;
  logger.info(`Client ${ws.id} added to chatroom ${chatroomId}. Total clients in room: ${activeChatrooms.get(chatroomId)?.size}`);

  // Clear any pending cleanup timeout for this chatroom
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
        
        // Broadcast that this user has left/removed
        const leaveNotice = JSON.stringify({
          type: 'userLeft',
          chatroomId,
          userAid: ws.userAid,
          username: ws.username,
          timestamp: new Date().toISOString(),
          isCreator: false // Creators cannot be banned
        });

        chatroomClients.forEach(client => {
          if (client.id !== wsId && client.readyState === WebSocket.OPEN) {
            client.send(leaveNotice);
          }
        });

        // Remove from room map to stop further messages
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
  if (chatroomClients) {
    chatroomClients.delete(ws.id);
    
    // Mark as left in DB instead of removing immediately
    try {
      if (ws.userAid) {
        const chatroom = await ChatRoom.findById(chatroomId);
        if (chatroom) {
          const participant = chatroom.participants.find(p => p.userAid === ws.userAid);
          if (participant) {
            participant.leftAt = new Date();
            
            // If the disconnected user was the host, transfer host status to the earliest joined participant who hasn't left
            if (chatroom.hostAid === ws.userAid) {
              const remainingParticipants = chatroom.participants.filter(p => !p.leftAt);
              if (remainingParticipants.length > 0) {
                const newHost = remainingParticipants.reduce((prev, curr) => {
                  const prevDate = prev.joinedAt ? new Date(prev.joinedAt).getTime() : Infinity;
                  const currDate = curr.joinedAt ? new Date(curr.joinedAt).getTime() : Infinity;
                  return prevDate < currDate ? prev : curr;
                }, remainingParticipants[0]);
                chatroom.hostAid = newHost.userAid;
                logger.info(`Host status transferred to ${newHost.userAid} in chatroom ${chatroomId} after disconnect`);

                // Broadcast host update
                const chatroomClients = activeChatrooms.get(chatroomId);
                if (chatroomClients) {
                  const hostUpdate = JSON.stringify({
                    type: 'hostUpdated',
                    chatroomId: chatroomId,
                    hostAid: chatroom.hostAid
                  });
                  chatroomClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(hostUpdate);
                    }
                  });
                }
              }
            }

            await chatroom.save();
            chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
            logger.info(`Marked participant ${ws.userAid} as left in chatroom ${chatroomId} due to disconnect`);
          }
        }
      }
    } catch (err) {
      logger.error(`Error marking participant as left on disconnect: ${err}`);
    }

    if (chatroomClients.size === 0) {
      activeChatrooms.delete(chatroomId);

      // Start a 24-hour cleanup timer when the last user leaves the memory map
      const timeout = setTimeout(async () => {
        try {
          const chatroom = await ChatRoom.findById(chatroomId);
          // Only delete if the room is still empty after 24 hours
          if (chatroom && chatroom.participants.length === 0) {
            await cleanupChatroom(chatroomId);
            logger.info(`Chatroom ${chatroomId} deleted after 24 hours of inactivity`);
          }
          chatroomCleanupTimeouts.delete(chatroomId);
        } catch (err) {
          logger.error(`Error in delayed chatroom cleanup for ${chatroomId}: ${err}`);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      chatroomCleanupTimeouts.set(chatroomId, timeout);
      logger.info(`Started 24-hour cleanup timeout for chatroom ${chatroomId}`);
    }
    delete ws.chatroomId;
    logger.info(`Client ${ws.id} removed from chatroom ${chatroomId}. Total clients in room: ${activeChatrooms.get(chatroomId)?.size || 0}`);
  }

  // Notify remaining participants that this user left/disconnected
  try {
    const remaining = activeChatrooms.get(chatroomId);
    if (remaining && ws.userAid) {
      const chatroom = await ChatRoom.findById(chatroomId);
      const isCreatorLeaving = chatroom?.creatorAid === ws.userAid;
      
      const leaveNotice = JSON.stringify({
        type: 'userLeft',
        chatroomId,
        userAid: ws.userAid,
        username: ws.username,
        timestamp: new Date().toISOString(),
        isCreator: isCreatorLeaving
      });
      remaining.forEach(client => {
        if (client.id === ws.id) return; // safety: skip the leaving client
        if (client.readyState === WebSocket.OPEN) {
          client.send(leaveNotice);
        }
      });
    }
  } catch (err) {
    logger.error(`Failed to broadcast userLeft for ${ws.id}: ${err}`);
  }
}

export async function handleExplicitLeave(chatroomId: string, ws: CustomWebSocket) {
  try {
    if (!ws.userAid) return;
    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom) return;

    const participant = chatroom.participants.find(p => p.userAid === ws.userAid);
    if (!participant) return;

    // Mark user as left instead of removing immediately
    participant.leftAt = new Date();

    // If the leaving user is the host, transfer host status if possible to someone online
    if (chatroom.hostAid === ws.userAid) {
      const remainingParticipants = chatroom.participants.filter(p => !p.leftAt);
      if (remainingParticipants.length > 0) {
        const newHost = remainingParticipants.reduce((prev, curr) => {
          const prevDate = prev.joinedAt ? new Date(prev.joinedAt).getTime() : Infinity;
          const currDate = curr.joinedAt ? new Date(curr.joinedAt).getTime() : Infinity;
          return prevDate < currDate ? prev : curr;
        }, remainingParticipants[0]);
        chatroom.hostAid = newHost.userAid;
        logger.info(`Host status transferred to ${newHost.userAid} in chatroom ${chatroomId} (explicit leave)`);

        // Broadcast host update
        const chatroomClients = activeChatrooms.get(chatroomId);
        if (chatroomClients) {
          const hostUpdate = JSON.stringify({
            type: 'hostUpdated',
            chatroomId: chatroomId,
            hostAid: chatroom.hostAid
          });
          chatroomClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(hostUpdate);
            }
          });
        }
      }
    }

    await chatroom.save();
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');
    logger.info(`Marked participant ${ws.userAid} as left in chatroom ${chatroomId} in DB (explicit leave)`);
  } catch (err) {
    logger.error(`Error handling explicit leave for participant ${ws.userAid} in chatroom ${chatroomId}: ${err}`);
  }
}
