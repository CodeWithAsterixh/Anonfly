import { WebSocket } from 'ws';
import bcrypt from 'bcrypt';
import pino from 'pino';
import { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import chatEventEmitter from '../../../helpers/eventEmitter';
import { getCachedMessages, cacheMessages } from '../../../helpers/messageCache';
import { activeChatrooms, addClientToChatroom, removeClientFromChatroom } from '../clientManager';
import env from '../../../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleJoinChatroom(
  wsClient: CustomWebSocket,
  parsedMessage: any,
  handleParsedMessage: (wsClient: CustomWebSocket, parsedMessage: any) => Promise<void>
) {
  const { chatroomId, userAid, username, password, publicKey, exchangePublicKey } = parsedMessage;

  // If the client is already in a chatroom, remove them from the previous one first
  if (wsClient.chatroomId && wsClient.chatroomId !== chatroomId) {
    logger.info(`Client ${wsClient.id} switching from room ${wsClient.chatroomId} to ${chatroomId}`);
    await removeClientFromChatroom(wsClient.chatroomId, wsClient);
  }

  wsClient.syncing = true;
  wsClient.userAid = userAid;
  wsClient.username = username;
  
  const chatroom = await ChatRoom.findById(chatroomId);
  if (!chatroom) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Chatroom not found' }));
    wsClient.syncing = false;
    return;
  }

  const participant = chatroom.participants.find(p => p.userAid === wsClient.userAid);

  // Migration for existing rooms without creatorAid
  if (!chatroom.creatorAid) {
    chatroom.creatorAid = chatroom.hostAid;
    await chatroom.save();
  }

  // If joining user is the creator, they become the host automatically
  if (wsClient.userAid === chatroom.creatorAid && chatroom.hostAid !== wsClient.userAid) {
    chatroom.hostAid = wsClient.userAid;
    await chatroom.save();
    
    // Notify room of host change
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
  
  // Password verification for locked rooms
  if (chatroom.isLocked && chatroom.password && !participant) {
    if (!password) {
      wsClient.send(JSON.stringify({ 
        type: 'error', 
        message: 'Password required for this chatroom',
        requiresPassword: true 
      }));
      wsClient.syncing = false;
      return;
    }

    const isMatch = password === chatroom.password || await bcrypt.compare(password, chatroom.password);
    if (!isMatch) {
      wsClient.send(JSON.stringify({ type: 'error', message: 'Incorrect password' }));
      wsClient.syncing = false;
      return;
    }
  }

  addClientToChatroom(chatroomId, wsClient);
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (participant) {
    // Check if they left more than 1 hour ago
    if (participant.leftAt && participant.leftAt < oneHourAgo) {
      logger.info(`User ${wsClient.userAid} rejoined after 1 hour. Resetting joinedAt.`);
      participant.joinedAt = new Date();
    }
    // Always clear leftAt when rejoining
    participant.leftAt = undefined;
    await chatroom.save();
  } else if (wsClient.username && wsClient.userAid) {
    // If not a participant yet, add them
    chatroom.participants.push({
      userAid: wsClient.userAid,
      username: wsClient.username,
      publicKey: publicKey,
      exchangePublicKey: exchangePublicKey,
      joinedAt: new Date()
    });
    // If no host, set as host
    if (!chatroom.hostAid) {
      chatroom.hostAid = wsClient.userAid;
    }
    await chatroom.save();
    chatEventEmitter.emit(`chatroomUpdated:${chatroomId}`);
    chatEventEmitter.emit('chatroomListUpdated');
  }
  
  const finalPublicKey = participant?.publicKey || publicKey;
  const finalExchangePublicKey = participant?.exchangePublicKey || exchangePublicKey;

  // Check if creator is online
  const chatroomClients = activeChatrooms.get(chatroomId);
  const isCreatorOnline = Array.from(chatroomClients?.values() || []).some(c => c.userAid === chatroom.creatorAid);

  wsClient.send(JSON.stringify({ 
    type: 'joinSuccess', 
    chatroomId: chatroomId,
    encryptedRoomKey: chatroom.encryptedRoomKey,
    roomKeyIv: chatroom.roomKeyIv,
    hostAid: chatroom.hostAid,
    creatorAid: chatroom.creatorAid,
    isCreatorOnline,
    // Only send participants who are currently online (no leftAt)
    participants: chatroom.participants.filter(p => !p.leftAt).map(p => ({
      userAid: p.userAid,
      username: p.username,
      publicKey: p.publicKey,
      exchangePublicKey: p.exchangePublicKey
    }))
  }));

  // Notify other participants that a user has joined
  try {
    if (chatroomClients) {
      const isCreatorJoining = wsClient.userAid === chatroom.creatorAid;
      const joinNotice = JSON.stringify({
        type: 'userJoined',
        chatroomId: chatroomId,
        userAid: wsClient.userAid,
        username: wsClient.username,
        publicKey: finalPublicKey,
        exchangePublicKey: finalExchangePublicKey,
        timestamp: new Date().toISOString(),
        isCreator: isCreatorJoining
      });
      chatroomClients.forEach(client => {
        if (client.id === wsClient.id) return; // skip the joining client
        if (client.readyState === WebSocket.OPEN) {
          client.send(joinNotice);
        }
      });
    }
  } catch (err) {
    logger.error(`Failed to broadcast userJoined for ${wsClient.id}: ${err}`);
  }

  // Send cached messages to the newly joined client
  try {
    let cachedMessages = await getCachedMessages(chatroomId);
    
    // If cache is empty, fetch from MongoDB and populate cache
    if (cachedMessages.length === 0 && chatroom) {
      logger.debug(`Cache miss for chatroom ${chatroomId}, fetching from DB`);
      cachedMessages = chatroom.messages.slice(-50).map(msg => {
        const plainMsg = (msg as any).toObject ? (msg as any).toObject() : msg;
        return {
          ...plainMsg,
          chatroomId: chatroomId
        };
      });
      
      if (cachedMessages.length > 0) {
        await cacheMessages(chatroomId, cachedMessages);
      }
    }

    // Filter messages: only show messages from the time they joined (incognito mode)
    const currentParticipant = chatroom.participants.find(p => p.userAid === wsClient.userAid);
    
    if (!currentParticipant) {
      logger.warn(`Sync blocked: User ${wsClient.userAid} is not a participant in ${chatroomId}`);
      wsClient.syncing = false;
      return;
    }

    const joinedAt = currentParticipant.joinedAt ? new Date(currentParticipant.joinedAt).getTime() : Date.now();
    const isCreator = wsClient.userAid === chatroom.creatorAid;

    for (const msg of cachedMessages) {
      const msgTimestamp = new Date(msg.timestamp).getTime();
      
      // Skip messages sent before the user joined/rejoined (Strict Incognito)
      // UNLESS the user is the creator (creator sees all history)
      if (!isCreator && msgTimestamp < joinedAt) {
        continue;
      }

      wsClient.send(JSON.stringify({
        type: 'chatMessage',
        messageId: msg._id || msg.id,
        chatroomId: msg.chatroomId,
        senderAid: msg.senderAid || msg.senderId,
        senderUsername: msg.senderUsername || (chatroom.participants.find(p => p.userAid === msg.senderAid)?.username || 'Anonymous'),
        content: msg.content,
        signature: msg.signature,
        timestamp: new Date(msg.timestamp).toISOString(),
        isEdited: msg.isEdited || false,
        isDeleted: msg.isDeleted || false,
        reactions: msg.reactions || [],
        replyTo: msg.replyTo ? {
          messageId: msg.replyTo.messageId.toString(),
          username: msg.replyTo.username,
          content: msg.replyTo.content,
          userAid: msg.replyTo.userAid
        } : undefined
      }));
    }
  } catch (err) {
    logger.error(`Failed to fetch/send cached messages for ${wsClient.id}: ${err}`);
  }

  wsClient.syncing = false;
  // Flush queued messages (if any) in order
  const queued = wsClient.messageQueue ? wsClient.messageQueue.splice(0) : [];
  for (const qm of queued) {
    await handleParsedMessage(wsClient, qm);
  }
}
