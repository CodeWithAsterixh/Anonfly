import mongoose from 'mongoose';
import { WebSocket } from 'ws';
import { cacheMessages, getCachedMessages } from '../../../helpers/messageCache';
import loggers from '../../../middlewares/logger';
import ChatRoom from '../../../models/chatRoom';
import Message from '../../../models/message';
import type { CustomWebSocket } from '../../../types/websocket';
import { activeChatrooms } from '../clientManager';

const logger = loggers.child('reactionHandler');

export async function handleReaction(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    logger.warn(`Reaction received from unauthenticated or unjoined client: ${wsClient.id}`);
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  const { chatroomId, messageId, emojiId, emojiValue, emojiType, userAid, username } = parsedMessage;
  
  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom || !mongoose.Types.ObjectId.isValid(messageId)) {
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return;
    }

    updateMessageReactions(message, { userAid, username, emojiId, emojiValue, emojiType });
    
    await message.save();
    
    await updateCachedReactions(chatroomId, messageId, message.reactions);

    broadcastReaction(chatroomId, messageId, message);
  } catch (err) {
    logger.error(`Error handling reaction: ${err}`);
  }
}

function updateMessageReactions(message: any, reaction: any) {
  if (!message.reactions) message.reactions = [];
  
  const existingIndex = message.reactions.findIndex((r: any) => r.userAid === reaction.userAid && r.emojiId === reaction.emojiId);
  if (existingIndex > -1) {
    message.reactions.splice(existingIndex, 1);
  } else {
    message.reactions.push(reaction);
  }
}

async function updateCachedReactions(chatroomId: string, messageId: string, reactions: any[]) {
  const cachedMessages = await getCachedMessages(chatroomId);
  const cachedMsg = cachedMessages.find(m => (m._id || m.id || "").toString() === messageId);
  if (cachedMsg) {
    cachedMsg.reactions = reactions;
    await cacheMessages(chatroomId, cachedMessages);
  }
}

function broadcastReaction(chatroomId: string, messageId: string, message: any) {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
    const messageTime = new Date(message.timestamp).getTime();
    const reactionBroadcast = JSON.stringify({
      type: 'reactionUpdated',
      messageId,
      reactions: message.reactions
    });

    chatroomClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        // Only send to clients who joined before the message was sent
        if (client.joinedAt && messageTime < client.joinedAt.getTime()) {
          return;
        }
        client.send(reactionBroadcast);
      }
    });
  }
}
