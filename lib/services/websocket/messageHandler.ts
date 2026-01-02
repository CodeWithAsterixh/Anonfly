import { CustomWebSocket } from '../../types/websocket';
import pino from 'pino';
import env from '../../constants/env';
import { handleJoinChatroom } from './handlers/joinChatroom';
import { handleTyping } from './handlers/typing';
import { handleSaveRoomKey } from './handlers/saveRoomKey';
import { handleLeaveChatroom } from './handlers/leaveChatroom';
import { handleMessage } from './handlers/message';
import { handleReaction } from './handlers/reaction';
import { handleEditMessage } from './handlers/editMessage';
import { handleDeleteMessage } from './handlers/deleteMessage';
import { handleSignal } from './handlers/signal';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleParsedMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (parsedMessage.type === 'ping') {
    wsClient.send(JSON.stringify({ type: 'pong' }));
    return;
  }

  // If syncing (server is sending cached messages), queue incoming chat messages
  if (wsClient.syncing) {
    if (!wsClient.messageQueue) wsClient.messageQueue = [];
    wsClient.messageQueue.push(parsedMessage);
    return;
  }

  switch (parsedMessage.type) {
    case 'joinChatroom':
      if (parsedMessage.chatroomId && parsedMessage.userAid && parsedMessage.username) {
        await handleJoinChatroom(wsClient, parsedMessage, handleParsedMessage);
      }
      break;

    case 'typing':
      if (parsedMessage.chatroomId) {
        handleTyping(wsClient, parsedMessage);
      }
      break;

    case 'saveRoomKey':
      if (parsedMessage.chatroomId && parsedMessage.encryptedKey) {
        await handleSaveRoomKey(wsClient, parsedMessage);
      }
      break;

    case 'leaveChatroom':
      if (parsedMessage.chatroomId) {
        await handleLeaveChatroom(wsClient, parsedMessage);
      }
      break;

    case 'message':
      if (parsedMessage.chatroomId && parsedMessage.content) {
        await handleMessage(wsClient, parsedMessage);
      }
      break;

    case 'reaction':
      if (parsedMessage.chatroomId && parsedMessage.messageId) {
        await handleReaction(wsClient, parsedMessage);
      }
      break;

    case 'editMessage':
      if (parsedMessage.chatroomId && parsedMessage.messageId && parsedMessage.newContent) {
        await handleEditMessage(wsClient, parsedMessage);
      }
      break;

    case 'deleteMessage':
      if (parsedMessage.chatroomId && parsedMessage.messageId) {
        await handleDeleteMessage(wsClient, parsedMessage);
      }
      break;

    default:
      // Broadcast unknown message types to the chatroom (signaling)
      const handled = handleSignal(wsClient, parsedMessage);
      if (!handled) {
        wsClient.send(JSON.stringify({ type: 'error', message: 'Unknown message type or invalid chatroom' }));
      }
      break;
  }
}
