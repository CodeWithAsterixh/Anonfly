import { WebSocket } from 'ws';
import loggers from '../../../middlewares/logger';
import type { CustomWebSocket } from '../../../types/websocket';
import ChatRoom from '../../../models/chatRoom';
import { activeChatrooms } from '../clientManager';

const logger = loggers.child('rotateKeyHandler');

export async function handleRotateKey(wsClient: CustomWebSocket, parsedMessage: any) {
  const { chatroomId, keys } = parsedMessage; // keys: { [userAid]: encryptedKey }

  if (!chatroomId || !keys) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid rotation payload' }));
    return;
  }

  const chatroom = await ChatRoom.findById(chatroomId);
  if (!chatroom) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Chatroom not found' }));
    return;
  }

  // Only host can rotate keys (for now)
  if (chatroom.hostAid !== wsClient.userAid) {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Only host can rotate keys' }));
    return;
  }

  logger.info(`Rotating keys for chatroom ${chatroomId}`);

  // Update participants in DB (for offline access/reconnect)
  const bulkOps = Object.keys(keys).map(userAid => ({
    updateOne: {
      filter: { _id: chatroom._id, 'participants.userAid': userAid },
      update: { $set: { 'participants.$.encryptedSessionKey': keys[userAid] } }
    }
  }));

  if (bulkOps.length > 0) {
      try {
        await ChatRoom.bulkWrite(bulkOps);
      } catch (err) {
        logger.error(`Failed to update DB for key rotation: ${err}`);
      }
  }

  // Broadcast to online clients
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
    chatroomClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userAid) {
        const encryptedKey = keys[client.userAid];
        if (encryptedKey) {
          client.send(JSON.stringify({
            type: 'rotateKey',
            chatroomId,
            encryptedKey,
            hostAid: chatroom.hostAid
          }));
        }
      }
    });
  }
}
