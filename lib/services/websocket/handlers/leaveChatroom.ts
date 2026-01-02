import type { CustomWebSocket } from '../../../types/websocket';
import { removeClientFromChatroom, handleExplicitLeave } from '../clientManager';

export async function handleLeaveChatroom(wsClient: CustomWebSocket, parsedMessage: any) {
  const { chatroomId } = parsedMessage;
  if (wsClient.chatroomId === chatroomId) {
    await removeClientFromChatroom(chatroomId, wsClient);
    await handleExplicitLeave(chatroomId, wsClient);
    wsClient.send(JSON.stringify({ type: 'leaveSuccess', chatroomId: chatroomId }));
  } else {
    wsClient.send(JSON.stringify({ type: 'error', message: 'Not in the specified chatroom' }));
  }
}
