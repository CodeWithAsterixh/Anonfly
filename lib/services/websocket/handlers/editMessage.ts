import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';
import { updateMessageInCache } from '../../../helpers/messageCache';
import env from '../../../constants/env';
import { z } from 'zod';

const editMessageSchema = z.object({
  chatroomId: z.string().min(1),
  messageId: z.string().min(1),
  newContent: z.string().min(1)
});

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleEditMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  // Validate message structure
  const validation = editMessageSchema.safeParse(parsedMessage);
  if (!validation.success) {
    logger.warn(`Invalid edit message structure from ${wsClient.id}: ${validation.error.message}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid edit message structure' }));
    return;
  }

  const { chatroomId, messageId, newContent } = validation.data;
  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (chatroom && mongoose.Types.ObjectId.isValid(messageId)) {
      const messageIndex = chatroom.messages.findIndex(m => (m._id || (m as any).id).toString() === messageId);
      if (messageIndex > -1) {
        const message = chatroom.messages[messageIndex];
        if (message.senderAid !== wsClient.userAid) {
          wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized to edit this message' }));
          return;
        }

        const messageTime = new Date(message.timestamp).getTime();
        if (Date.now() - messageTime > 10 * 60 * 1000) {
          wsClient.send(JSON.stringify({ type: 'error', message: 'Edit window expired' }));
          return;
        }

        chatroom.messages[messageIndex].content = newContent;
        chatroom.messages[messageIndex].isEdited = true;

        for (let i = 0; i < chatroom.messages.length; i++) {
          if (chatroom.messages[i].replyTo && chatroom.messages[i].replyTo!.messageId.toString() === messageId) {
            chatroom.messages[i].replyTo!.content = newContent;
          }
        }

        chatroom.markModified('messages');
        await chatroom.save();

        await updateMessageInCache(chatroomId, {
          id: messageId,
          content: newContent,
          isEdited: true
        });
        
        const repliesToUpdate = chatroom.messages.filter(msg => msg.replyTo && msg.replyTo.messageId.toString() === messageId);
        for (const reply of repliesToUpdate) {
          await updateMessageInCache(chatroomId, {
            id: reply._id.toString(),
            replyTo: {
              ...reply.replyTo,
              content: newContent
            }
          });
        }

        const chatroomClients = activeChatrooms.get(chatroomId);
        if (chatroomClients) {
          const editBroadcast = JSON.stringify({
            type: 'messageEdited',
            messageId,
            newContent,
            isEdited: true
          });
          chatroomClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(editBroadcast);
            }
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Error handling edit: ${err}`);
  }
}
