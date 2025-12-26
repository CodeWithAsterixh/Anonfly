import { CHAT_WS_URL } from "lib/constants/api";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

class WebSocketController {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

  public connect(onOpen?: () => void, onClose?: () => void, onError?: (event: Event) => void) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.warn('WebSocket is already connected or connecting.');
      return;
    }

    this.ws = new WebSocket(CHAT_WS_URL);

    this.ws.onopen = () => {
      console.log('WebSocket connected.');
      if (onOpen) onOpen();
    };

    this.ws.onmessage = (event) => {
      try {
        const parsedMessage: WebSocketMessage = JSON.parse(event.data as string);
        const handlers = this.messageHandlers.get(parsedMessage.type);
        if (handlers) {
          handlers.forEach(handler => handler(parsedMessage));
        } else {
          console.warn(`No handler for message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected.');
      if (onClose) onClose();
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      if (onError) onError(event);
    };
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected. Cannot send message.');
    }
  }

  public on(messageType: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)?.push(handler);
  }

  public off(messageType: string, handler: (data: any) => void) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      this.messageHandlers.set(messageType, handlers.filter(h => h !== handler));
    }
  }

  // Specific message sending functions
  public sendChatMessage(chatroomId: string, content: string, userId: string, username: string) {
    this.sendMessage({
      type: 'message',
      chatroomId,
      content,
      userId,
      username,
    });
  }

  public joinChatroom(chatroomId: string, userId: string, username: string) {
    this.sendMessage({
      type: 'joinChatroom',
      chatroomId,
      userId,
      username,
    });
  }

  public leaveChatroom(chatroomId: string) {
    this.sendMessage({
      type: 'leaveChatroom',
      chatroomId,
    });
  }
}

export const webSocketController = new WebSocketController();