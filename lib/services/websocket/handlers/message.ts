import mongoose from 'mongoose';
import loggers from '../../../middlewares/logger';
import { WebSocket } from 'ws';
import { z } from 'zod';
import env from '../../../constants/env';
import { verifySignature } from '../../../helpers/crypto';
import { addMessageToCache } from '../../../helpers/messageCache';
import ChatRoom from '../../../models/chatRoom';
import Message from '../../../models/message';
import type { CustomWebSocket } from '../../../types/websocket';
import { activeChatrooms } from '../clientManager';

const messageSchema = z.object({
  chatroomId: z.string().min(1),
  content: z.string().min(1),
  signature: z.string().optional(),
  replyTo: z.object({
    messageId: z.string(),
    senderUsername: z.string().optional(),
    username: z.string().optional(),
    content: z.string(),
    userAid: z.string()
  }).optional()
});

const logger = loggers.child('messageHandler');

export async function handleMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    logger.warn(`Message received from unauthenticated or unjoined client: ${wsClient.id}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  // Validate message structure
  const validation = messageSchema.safeParse(parsedMessage);
  if (!validation.success) {
    logger.warn(`Invalid message structure from ${wsClient.id}: ${validation.error.message}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid message structure' }));
    return;
  }

  const { chatroomId, content, signature, replyTo } = validation.data;
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
    if (participant?.publicKey) {
      const isValid = verifySignature(content, signature, participant.publicKey);
      if (!isValid) {
        logger.warn(`Invalid signature from ${wsClient.userAid} in chatroom ${chatroomId}`);
        wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid message signature' }));
        return;
      }
    }
  }

  // Atomic increment to get unique sequence ID
  const updatedRoom = await ChatRoom.findOneAndUpdate(
    { _id: chatroomId },
    { $inc: { messageSequenceCounter: 1 } },
    { new: true, select: 'messageSequenceCounter' }
  );

  if (!updatedRoom) {
     wsClient.send(JSON.stringify({ type: 'error', message: 'Failed to generate sequence ID' }));
     return;
  }
  
  const sequenceId = updatedRoom.messageSequenceCounter;

  const newMessage = new Message({
    chatroomId: chatroomId,
    senderAid: wsClient.userAid,
    senderUsername: wsClient.username || 'Anonymous',
    content,
    signature,
    timestamp: new Date(),
    sequenceId,
    isEdited: false,
    isDeleted: false,
    reactions: [],
    replyTo: replyTo ? {
      messageId: replyTo.messageId,
      username: replyTo.senderUsername || replyTo.username || "",
      content: replyTo.content,
      userAid: replyTo.userAid,
    } : undefined
  });

  await newMessage.save();

  // Update last message in chatroom
  await ChatRoom.updateOne(
    { _id: chatroomId },
    { 
      $set: { 
        lastMessage: {
          content: newMessage.content,
          senderUsername: newMessage.senderUsername,
          timestamp: newMessage.timestamp
        } 
      } 
    }
  );

  // Update cache
  addMessageToCache(chatroomId, {
    ...newMessage.toObject(),
    _id: newMessage._id,
    chatroomId: new mongoose.Types.ObjectId(chatroomId),
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
      sequenceId,
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
        // Only send to clients who joined before this message was sent
        if (client.joinedAt && newMessage.timestamp < client.joinedAt) {
          return;
        }

        if (client.bufferedAmount > 1024 * 1024) {
          logger.warn(`Backpressure: Client ${client.id} buffer is full. Skipping message.`);
          return;
        }
        client.send(broadcastData);
      }
    });
  }
}
