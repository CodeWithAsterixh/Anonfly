import { WebSocket } from 'ws';
import type { CustomWebSocket } from '../../../types/websocket';
import { activeChatrooms } from '../clientManager';

export function handleTyping(wsClient: CustomWebSocket, parsedMessage: any) {
  const { chatroomId, isTyping } = parsedMessage;
  const chatroomClients = activeChatrooms.get(chatroomId);
  
  if (chatroomClients && wsClient.userAid) {
    const typingUpdate = JSON.stringify({
      type: 'userTyping',
      chatroomId,
      userAid: wsClient.userAid,
      username: wsClient.username,
      isTyping
    });

    chatroomClients.forEach(client => {
      if (client.id !== wsClient.id && client.readyState === WebSocket.OPEN) {
        client.send(typingUpdate);
      }
    });
  }
}
