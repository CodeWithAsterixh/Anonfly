import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';
import { getCachedMessages, cacheMessages } from '../../../helpers/messageCache';
import env from '../../../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleReaction(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    logger.warn(`Reaction received from unauthenticated or unjoined client: ${wsClient.id}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  const { chatroomId, messageId, emojiId, emojiValue, emojiType, userAid, username } = parsedMessage;
  
  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (chatroom && mongoose.Types.ObjectId.isValid(messageId)) {
      const message = chatroom.messages.find(m => (m._id || (m as any).id).toString() === messageId);
      if (message) {
        if (!message.reactions) message.reactions = [];
        
        const existingIndex = message.reactions.findIndex(r => r.userAid === userAid && r.emojiId === emojiId);
        if (existingIndex > -1) {
          message.reactions.splice(existingIndex, 1);
        } else {
          message.reactions.push({ userAid, username, emojiId, emojiValue, emojiType });
        }
        
        chatroom.markModified('messages');
        await chatroom.save();
        
        const cachedMessages = await getCachedMessages(chatroomId);
        const cachedMsg = cachedMessages.find(m => (m._id || m.id || "").toString() === messageId);
        if (cachedMsg) {
          cachedMsg.reactions = message.reactions;
          await cacheMessages(chatroomId, cachedMessages);
        }

        const chatroomClients = activeChatrooms.get(chatroomId);
        if (chatroomClients) {
          const reactionBroadcast = JSON.stringify({
            type: 'reactionUpdate',
            messageId,
            reactions: message.reactions
          });
          chatroomClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(reactionBroadcast);
            }
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Error handling reaction: ${err}`);
  }
}
