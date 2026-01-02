import { WebSocket } from 'ws';
import type { CustomWebSocket } from '../../../types/websocket';
import { activeChatrooms } from '../clientManager';

export function handleSignal(wsClient: CustomWebSocket, parsedMessage: any) {
  if (parsedMessage.chatroomId && wsClient.chatroomId === parsedMessage.chatroomId) {
    const chatroomClients = activeChatrooms.get(parsedMessage.chatroomId);
    if (chatroomClients) {
      const signalToBroadcast = JSON.stringify({
        ...parsedMessage,
        senderAid: wsClient.userAid,
        senderUsername: wsClient.username,
      });
      chatroomClients.forEach(client => {
        if (client.id !== wsClient.id && client.readyState === WebSocket.OPEN) {
          client.send(signalToBroadcast);
        }
      });
    }
    return true; // Handled
  }
  return false; // Not handled
}
