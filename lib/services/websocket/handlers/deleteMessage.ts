import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import Message from '../../../models/message';
import { activeChatrooms } from '../clientManager';
import { updateMessageInCache } from '../../../helpers/messageCache';
import env from '../../../constants/env';
import ChatRoom from '../../../models/chatRoom';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export async function handleDeleteMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (!wsClient.userAid || !wsClient.chatroomId) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
    return;
  }

  const { chatroomId, messageId } = parsedMessage;
  try {
    const chatroom = await ChatRoom.findById(chatroomId);
    if (!chatroom || !mongoose.Types.ObjectId.isValid(messageId)) {
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return;
    }

    if (message.senderAid !== wsClient.userAid) {
      wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized to delete this message' }));
      return;
    }

    await deleteMessageData(chatroom, message);
    await deleteCacheData(chatroomId, messageId, chatroom);

    const messageTime = new Date(message.timestamp).getTime();
    broadcastDeletion(chatroomId, messageId, messageTime);

  } catch (err) {
    logger.error(`Error handling deletion: ${err}`);
  }
}

async function deleteMessageData(chatroom: any, message: any) {
  message.content = '[This message was deleted]';
  message.isDeleted = true;
  message.signature = undefined;
  await message.save();

  // Update replies
  await Message.updateMany(
    { chatroomId: chatroom._id, "replyTo.messageId": message._id },
    { $set: { "replyTo.content": "[This message was deleted]" } }
  );
}

async function deleteCacheData(chatroomId: string, messageId: string, chatroom: any) {
  await updateMessageInCache(chatroomId, {
    id: messageId,
    content: '[This message was deleted]',
    isDeleted: true,
    signature: undefined
  });

  const repliesToUpdate = await Message.find({ chatroomId: chatroom._id, "replyTo.messageId": messageId });
  for (const reply of repliesToUpdate) {
    await updateMessageInCache(chatroomId, {
      id: reply._id.toString(),
      replyTo: {
        ...reply.replyTo,
        content: '[This message was deleted]'
      }
    });
  }
}

function broadcastDeletion(chatroomId: string, messageId: string, messageTime: number) {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (!chatroomClients) return;

  const deleteBroadcast = JSON.stringify({
    type: 'messageDeleted',
    messageId,
    isDeleted: true,
    content: "[This message was deleted]"
  });

  chatroomClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Only send to clients who joined before this message was originally sent
      if (!client.joinedAt || messageTime >= client.joinedAt.getTime()) {
        client.send(deleteBroadcast);
      }
    }
  });
}
