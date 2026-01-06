import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import env from '../../constants/env';
import { CustomWebSocket } from '../../types/websocket';
import { clients, removeClientFromChatroom } from './clientManager';
import { handleParsedMessage } from './messageHandler';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

/**
 * Track active connections per IP to prevent DoS attacks.
 */
const connectionsPerIp = new Map<string, number>();

/**
 * Maximum number of concurrent WebSocket connections allowed per single IP address.
 */
const MAX_CONNECTIONS_PER_IP = 5;

/**
 * Initializes the WebSocket server and sets up event listeners for connections.
 * 
 * @param {WebSocketServer} wss - The WebSocket server instance.
 */
export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const currentConns = connectionsPerIp.get(ip) || 0;

    // IP-based connection limiting
    if (currentConns >= MAX_CONNECTIONS_PER_IP) {
      logger.warn(`Connection rejected: IP ${ip} exceeded limit of ${MAX_CONNECTIONS_PER_IP}`);
      ws.close(1008, 'Too many connections from this IP');
      return;
    }

    connectionsPerIp.set(ip, currentConns + 1);

    const customWs = ws as CustomWebSocket;
    customWs.id = uuidv4();
    customWs.isAlive = true;
    customWs.syncing = false;
    customWs.messageQueue = [];
    clients.set(customWs.id, customWs);
    logger.info(`Client connected: ${customWs.id}. Total clients: ${clients.size}`);

    // Message rate limiting (Leaky bucket algorithm)
    let messageTokens = 10;
    const MAX_TOKENS = 10;
    const REFILL_RATE = 1; // 1 token per second

    const refillInterval = setInterval(() => {
      messageTokens = Math.min(MAX_TOKENS, messageTokens + REFILL_RATE);
    }, 1000);

    customWs.on('pong', () => {
      customWs.isAlive = true;
    });

    customWs.on('message', async (data: string) => {
      try {
        // Enforce rate limiting
        if (messageTokens <= 0) {
          logger.warn(`Rate limit exceeded for client: ${customWs.id}`);
          customWs.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Please wait.' }));
          return;
        }
        messageTokens -= 1;

        const parsedMessage = JSON.parse(data);
        await handleParsedMessage(customWs, parsedMessage);
      } catch (err) {
        logger.error(`Failed to handle message from ${customWs.id}: ${err}`);
      }
    });

    customWs.on('close', async () => {
      const conns = connectionsPerIp.get(ip) || 1;
      connectionsPerIp.set(ip, conns - 1);
      clearInterval(refillInterval);

      clients.delete(customWs.id);
      if (customWs.chatroomId) {
        // Handle database cleanup when user disconnects
        await removeClientFromChatroom(customWs.chatroomId, customWs);
      }
      logger.info(`Client disconnected: ${customWs.id}. Total clients: ${clients.size}`);
    });

    customWs.on('error', (err) => {
      logger.error(`WebSocket error for client ${customWs.id}: ${err}`);
    });
  });

  // Keep-alive mechanism: Ping clients every 30 seconds
  const pingInterval = setInterval(() => {
    clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });
}
