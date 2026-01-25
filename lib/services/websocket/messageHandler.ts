import { CustomWebSocket } from '../../types/websocket';
import loggers from '../../middlewares/logger';
import { handleJoinChatroom } from './handlers/joinChatroom';
import { handleTyping } from './handlers/typing';
import { handleSaveRoomKey } from './handlers/saveRoomKey';
import { handleLeaveChatroom } from './handlers/leaveChatroom';
import { handleMessage } from './handlers/message';
import { handleReaction } from './handlers/reaction';
import { handleEditMessage } from './handlers/editMessage';
import { handleDeleteMessage } from './handlers/deleteMessage';
import { handleSignal } from './handlers/signal';
import { handleRotateKey } from './handlers/rotateKey';

const logger = loggers.child({ module: 'messageHandler' });

type MessageHandler = {
  validate: (msg: any) => boolean;
  execute: (wsClient: CustomWebSocket, msg: any) => Promise<void> | void;
};

const handlers: Record<string, MessageHandler> = {
  joinChatroom: {
    validate: (msg) => !!(msg.chatroomId && msg.userAid && msg.username),
    execute: (ws, msg) => handleJoinChatroom(ws, msg, handleParsedMessage),
  },
  typing: {
    validate: (msg) => !!msg.chatroomId,
    execute: (ws, msg) => handleTyping(ws, msg),
  },
  saveRoomKey: {
    validate: (msg) => !!(msg.chatroomId && msg.encryptedKey),
    execute: (ws, msg) => handleSaveRoomKey(ws, msg),
  },
  leaveChatroom: {
    validate: (msg) => !!msg.chatroomId,
    execute: (ws, msg) => handleLeaveChatroom(ws, msg),
  },
  message: {
    validate: (msg) => !!(msg.chatroomId && msg.content),
    execute: (ws, msg) => handleMessage(ws, msg),
  },
  reaction: {
    validate: (msg) => !!(msg.chatroomId && msg.messageId),
    execute: (ws, msg) => handleReaction(ws, msg),
  },
  editMessage: {
    validate: (msg) => !!(msg.chatroomId && msg.messageId && msg.newContent),
    execute: (ws, msg) => handleEditMessage(ws, msg),
  },
  deleteMessage: {
    validate: (msg) => !!(msg.chatroomId && msg.messageId),
    execute: (ws, msg) => handleDeleteMessage(ws, msg),
  },
  rotateKey: {
    validate: (msg) => !!(msg.chatroomId && msg.keys),
    execute: (ws, msg) => handleRotateKey(ws, msg),
  },
};

export async function handleParsedMessage(wsClient: CustomWebSocket, parsedMessage: any) {
  if (parsedMessage.type === 'ping') {
    wsClient.send(JSON.stringify({ type: 'pong' }));
    return;
  }

  // If syncing (server is sending cached messages), queue incoming chat messages
  if (wsClient.syncing) {
    wsClient.messageQueue ??= [];
    wsClient.messageQueue.push(parsedMessage);
    return;
  }

  const handler = handlers[parsedMessage.type];
  if (handler) {
    if (handler.validate(parsedMessage)) {
      await handler.execute(wsClient, parsedMessage);
    }
    return;
  }

  // Broadcast unknown message types to the chatroom (signaling)
  const handled = handleSignal(wsClient, parsedMessage);
  if (!handled) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Unknown message type or invalid chatroom' }));
  }
}
