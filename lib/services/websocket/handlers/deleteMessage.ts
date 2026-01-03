import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';
import { updateMessageInCache } from '../../../helpers/messageCache';
import env from '../../../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleDeleteMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  const { chatroomId, messageId } = parsedMessage;
  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (chatroom && mongoose.Types.ObjectId.isValid(messageId)) {
      const messageIndex = chatroom.messages.findIndex(m => (m._id || (m as any).id).toString() === messageId);
      if (messageIndex > -1) {
        const message = chatroom.messages[messageIndex];
        if (message.senderAid !== wsClient.userAid) {
          wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized to delete this message' }));
          return;
        }

        chatroom.messages[messageIndex].content = '[This message was deleted]';
        chatroom.messages[messageIndex].isDeleted = true;
        chatroom.messages[messageIndex].signature = undefined;

        for (let i = 0; i < chatroom.messages.length; i++) {
          if (chatroom.messages[i].replyTo && chatroom.messages[i].replyTo!.messageId.toString() === messageId) {
            chatroom.messages[i].replyTo!.content = '[This message was deleted]';
          }
        }

        chatroom.markModified('messages');
        await chatroom.save();

        await updateMessageInCache(chatroomId, {
          id: messageId,
          content: '[This message was deleted]',
          isDeleted: true,
          signature: undefined
        });
        
        const repliesToUpdate = chatroom.messages.filter(msg => msg.replyTo && msg.replyTo.messageId.toString() === messageId);
        for (const reply of repliesToUpdate) {
          await updateMessageInCache(chatroomId, {
            id: reply._id.toString(),
            replyTo: {
              ...reply.replyTo,
              content: '[This message was deleted]'
            }
          });
        }

        const messageTime = new Date(message.timestamp).getTime();
        const chatroomClients = activeChatrooms.get(chatroomId);
        if (chatroomClients) {
          const deleteBroadcast = JSON.stringify({
            type: 'messageDeleted',
            messageId,
            isDeleted: true,
            content: "[This message was deleted]"
          });
          chatroomClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              // Only send to clients who joined before this message was originally sent
              if (client.joinedAt && messageTime < client.joinedAt.getTime()) {
                return;
              }
              client.send(deleteBroadcast);
            }
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Error handling deletion: ${err}`);
  }
}
