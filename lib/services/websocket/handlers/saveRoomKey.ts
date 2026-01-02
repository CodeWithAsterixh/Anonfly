import { WebSocket } from 'ws';
import pino from 'pino';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';
import env from '../../../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export async function handleSaveRoomKey(wsClient: CustomWebSocket, parsedMessage: any) {
  const { chatroomId, encryptedKey, iv } = parsedMessage;
  const chatroom = await ChatRoom.findById(chatroomId);
  
  // Allow saving if room has no key yet OR if the sender is the host
  if (chatroom && (!chatroom.encryptedRoomKey || chatroom.hostAid === wsClient.userAid)) {
    chatroom.encryptedRoomKey = encryptedKey;
    chatroom.roomKeyIv = iv || 'none';
    await chatroom.save();
    logger.info(`Saved master room key for chatroom ${chatroomId}`);

    // Broadcast the new master key to everyone in the room
    const chatroomClients = activeChatrooms.get(chatroomId);
    if (chatroomClients) {
      const keyUpdate = JSON.stringify({
        type: 'masterKeyUpdate',
        chatroomId: chatroomId,
        encryptedRoomKey: chatroom.encryptedRoomKey,
        roomKeyIv: chatroom.roomKeyIv
      });
      chatroomClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(keyUpdate);
        }
      });
    }
  }
}
