import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';
import { updateMessageInCache } from '../../../helpers/messageCache';
import env from '../../../constants/env';
import { z } from 'zod';
import Message from '../../../models/message';

const editMessageSchema = z.object({
  chatroomId: z.string().min(1),
  messageId: z.string().min(1),
  newContent: z.string().min(1)
});

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export async function handleEditMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  const validation = editMessageSchema.safeParse(parsedMessage);
  if (!validation.success) {
    logger.warn(`Invalid edit message structure from ${wsClient.id}: ${validation.error.message}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid edit message structure' }));
    return;
  }

  const { chatroomId, messageId, newContent } = validation.data;

  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom || !mongoose.Types.ObjectId.isValid(messageId)) {
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return;
    }

    if (!validateEditPermissions(wsClient, message)) {
      return;
    }

    await updateMessageData(chatroom, message.sequenceId, messageId, newContent);
    await updateCacheData(chatroomId, messageId, newContent, chatroom);
    
    const messageTime = new Date(message.timestamp).getTime();
    broadcastEdit(chatroomId, messageId, newContent, messageTime);

  } catch (err) {
    logger.error(`Error handling edit: ${err}`);
  }
}

function validateEditPermissions(wsClient: CustomWebSocket, message: any): boolean {
  if (message.senderAid !== wsClient.userAid) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized to edit this message' }));
    return false;
  }

  const messageTime = new Date(message.timestamp).getTime();
  if (Date.now() - messageTime > 10 * 60 * 1000) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Edit window expired' }));
    return false;
  }

  return true;
}

async function updateMessageData(chatroom: any, messageIndex: number, messageId: string, newContent: string) {
  chatroom.messages[messageIndex].content = newContent;
  chatroom.messages[messageIndex].isEdited = true;

  // Update replies that reference this message
  for (const element of chatroom.messages) {
    if (element.replyTo && element.replyTo.messageId.toString() === messageId) {
      element.replyTo.content = newContent;
    }
  }

  chatroom.markModified('messages');
  await chatroom.save();
}

async function updateCacheData(chatroomId: string, messageId: string, newContent: string, chatroom: any) {
  await updateMessageInCache(chatroomId, {
    id: messageId,
    content: newContent,
    isEdited: true
  });

  const repliesToUpdate = chatroom.messages.filter((msg: any) => msg.replyTo && msg.replyTo.messageId.toString() === messageId);
  for (const reply of repliesToUpdate) {
    await updateMessageInCache(chatroomId, {
      id: reply._id.toString(),
      replyTo: {
        ...reply.replyTo,
        content: newContent
      }
    });
  }
}

function broadcastEdit(chatroomId: string, messageId: string, newContent: string, messageTime: number) {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (!chatroomClients) return;

  const editBroadcast = JSON.stringify({
    type: 'messageEdited',
    messageId,
    newContent,
    isEdited: true
  });

  chatroomClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Only send to clients who joined before this message was originally sent
      // or if they don't have a joinedAt timestamp (legacy/fallback)
      if (!client.joinedAt || messageTime >= client.joinedAt.getTime()) {
         client.send(editBroadcast);
      }
    }
  });
}
