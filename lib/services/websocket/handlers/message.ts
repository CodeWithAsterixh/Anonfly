import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom, { type IMessage } from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';
import { addMessageToCache } from '../../../helpers/messageCache';
import { verifySignature } from '../../../helpers/crypto';
import env from '../../../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    logger.warn(`Message received from unauthenticated or unjoined client: ${wsClient.id}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  const { chatroomId, content, signature, replyTo } = parsedMessage;
  if (!mongoose.Types.ObjectId.isValid(chatroomId)) {
    logger.warn(`Invalid chatroomId received from ${wsClient.id}: ${chatroomId}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid chatroom ID' }));
    return;
  }

  const chatroom = await ChatRoom.findById(chatroomId);
  if (!chatroom) {
    logger.warn(`Chatroom ${chatroomId} not found for message from ${wsClient.id}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Chatroom not found' }));
    return;
  }

  // Verify signature if present
  if (signature) {
    const participant = chatroom.participants.find(p => p.userAid === wsClient.userAid);
    if (participant && participant.publicKey) {
      const isValid = verifySignature(content, signature, participant.publicKey);
      if (!isValid) {
        logger.warn(`Invalid signature from ${wsClient.userAid} in chatroom ${chatroomId}`);
        wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid message signature' }));
        return;
      }
    }
  }

  const newMessage: IMessage = {
    _id: new mongoose.Types.ObjectId(),
    senderAid: wsClient.userAid,
    senderUsername: wsClient.username || 'Anonymous',
    content,
    signature,
    timestamp: new Date(),
    isEdited: false,
    isDeleted: false,
    reactions: [],
    replyTo: replyTo ? {
      messageId: replyTo.messageId,
      username: replyTo.senderUsername || replyTo.username,
      content: replyTo.content,
      userAid: replyTo.userAid
    } : undefined
  };

  chatroom.messages.push(newMessage);
  await chatroom.save();

  // Update cache
  addMessageToCache(chatroomId, {
    _id: newMessage._id,
    chatroomId: new mongoose.Types.ObjectId(chatroomId),
    senderAid: newMessage.senderAid,
    senderUsername: newMessage.senderUsername,
    content: newMessage.content,
    signature,
    timestamp: newMessage.timestamp,
    isEdited: false,
    isDeleted: false,
    reactions: [],
    replyTo: newMessage.replyTo
  } as any);

  // Broadcast message to everyone in the chatroom
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
    const broadcastData = JSON.stringify({
      type: 'chatMessage',
      messageId: newMessage._id.toString(),
      chatroomId,
      senderAid: wsClient.userAid,
      senderUsername: wsClient.username || 'Anonymous',
      content,
      signature,
      timestamp: newMessage.timestamp.toISOString(),
      isEdited: false,
      isDeleted: false,
      reactions: [],
      replyTo: newMessage.replyTo ? {
        messageId: newMessage.replyTo.messageId,
        userAid: newMessage.replyTo.userAid,
        senderUsername: newMessage.replyTo.username,
        content: newMessage.replyTo.content
      } : undefined
    });

    chatroomClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (client.bufferedAmount > 1024 * 1024) {
          logger.warn(`Backpressure: Client ${client.id} buffer is full. Skipping message.`);
          return;
        }
        client.send(broadcastData);
      }
    });
  }
}
