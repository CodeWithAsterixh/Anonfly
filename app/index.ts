// Core express dependencies
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { WebSocketServer, WebSocket } from 'ws';
import mongoose from 'mongoose';

// Security middleware

// Structured logging
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

// Helpers
import env from "../lib/constants/env";
import useRouter from "../lib/middlewares/routeHandler";
import helmetMiddleware from "../lib/middlewares/securityHeaders";
import withErrorHandling from "../lib/middlewares/withErrorHandling";
import { addMessageToCache, getCachedMessages } from '../lib/helpers/messageCache';
import cleanupChatroom from '../lib/helpers/cleanupChatroom';
import ChatRoom, { type IMessage } from '../lib/models/chatRoom';
import { verifySignature } from '../lib/helpers/crypto';

// Routes
import chatroomListRouter from "./routes/chatroom/chatroomlist";
import createChatroomRoute from "./routes/chatroom/createChatroom";
import getChatroomMessagesRoute from "./routes/chatroom/getChatroomMessages";
import joinChatroomRoute from "./routes/chatroom/joinChatroom";
import deleteChatroomRoute from "./routes/chatroom/deleteChatroom";
import getChatroomDetailsRoute from "./routes/chatroom/getChatroomDetails";
import editChatroomRoute from "./routes/chatroom/editChatroom";
import leaveChatroomRoute from "./routes/chatroom/leaveChatroom";
import deleteMessageRoute from "./routes/chatroom/deleteMessage"; // Import the new route
import challengeRoute from "./routes/auth/challenge";
import verifyRoute from "./routes/auth/verify";

import homeRoute from "./routes/homeRoute";
import healthzRoute from "./routes/healthzRoute";

// App setup
const app = express();
const PORT = process.env.PORT || 5000;

// Configure structured logger
const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Add logger to request object
const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req: any, res: any, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req: any, res: any) => `${req.method} ${req.url} completed with ${res.statusCode}`,
  customErrorMessage: (req: any, res: any, err?: Error) => `${req.method} ${req.url} failed with ${err?.message}`
});

// Static files
app.use(express.static("public")); 

// Security middleware
app.use(helmetMiddleware);
app.use(httpLogger);

// CORS configuration with strict options
app.use(cors({
  origin: env.NODE_ENV === 'production' 
    ? (env.ALLOWEDDOMAIN ? env.ALLOWEDDOMAIN.split(",").map(o => o.trim()) : [])
    : ['http://localhost:8000', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parsers with appropriate limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));


const router = useRouter(app);

app.use('/', chatroomListRouter);



// Routes
router(homeRoute);
router(healthzRoute);

router(createChatroomRoute);

router(getChatroomMessagesRoute);

router(deleteMessageRoute); // Use the new route

router(challengeRoute);
router(verifyRoute);

router(joinChatroomRoute);

router(getChatroomDetailsRoute);

router(deleteChatroomRoute);
router(editChatroomRoute);

router(leaveChatroomRoute);

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// WebSocket Server
const wss = new WebSocketServer({ server });

interface CustomWebSocket extends WebSocket {
  id: string;
  isAlive: boolean;
  userAid?: string; // Anonymous Identity
  chatroomId?: string; 
  username?: string; 
  syncing?: boolean; 
  messageQueue?: any[]; 
}

export const clients = new Map<string, CustomWebSocket>();
export const activeChatrooms = new Map<string, Map<string, CustomWebSocket>>(); // chatroomId -> Map<wsId, CustomWebSocket>

function addClientToChatroom(chatroomId: string, ws: CustomWebSocket) {
  if (!activeChatrooms.has(chatroomId)) {
    activeChatrooms.set(chatroomId, new Map<string, CustomWebSocket>());
  }
  activeChatrooms.get(chatroomId)?.set(ws.id, ws);
  ws.chatroomId = chatroomId;
  logger.info(`Client ${ws.id} added to chatroom ${chatroomId}. Total clients in room: ${activeChatrooms.get(chatroomId)?.size}`);
}

function removeClientFromChatroom(chatroomId: string, ws: CustomWebSocket) {
  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
    chatroomClients.delete(ws.id);
    if (chatroomClients.size === 0) {
      activeChatrooms.delete(chatroomId);
    }
    delete ws.chatroomId;
    logger.info(`Client ${ws.id} removed from chatroom ${chatroomId}. Total clients in room: ${activeChatrooms.get(chatroomId)?.size}`);
  }

  // Notify remaining participants that this user left/disconnected
  try {
    const remaining = activeChatrooms.get(chatroomId);
    if (remaining && ws.userAid) {
      const leaveNotice = JSON.stringify({
        type: 'userLeft',
        chatroomId,
        userAid: ws.userAid,
        username: ws.username,
        timestamp: new Date().toISOString(),
      });
      remaining.forEach(client => {
        if (client.id === ws.id) return; // safety: skip the leaving client
        if (client.readyState === WebSocket.OPEN) {
          client.send(leaveNotice);
        }
      });
    }
  } catch (err) {
    logger.error(`Failed to broadcast userLeft for ${ws.id}: ${err}`);
  }

  // Also remove the participant from the persistent chatroom participants list
  (async () => {
    try {
      if (!ws.userAid) return;
      const chatroom = await ChatRoom.findById(chatroomId);
      if (!chatroom) return;
      const participantIndex = chatroom.participants.findIndex(p => p.userAid === ws.userAid);
      if (participantIndex === -1) return;

      // Remove user from participants list
      chatroom.participants.splice(participantIndex, 1);

      // If the leaving user is the host, transfer host status or delete chatroom
      if (chatroom.hostAid === ws.userAid) {
        if (chatroom.participants.length > 0) {
          const newHost = chatroom.participants.reduce((prev, curr) => {
            return (prev.joinedAt && curr.joinedAt && prev.joinedAt.getTime() < curr.joinedAt.getTime()) ? prev : curr;
          }, chatroom.participants[0]);
          chatroom.hostAid = newHost.userAid;
        } else {
          // No participants left: clear cache and delete chatroom
          await cleanupChatroom(chatroomId);
          return;
        }
      }

      await chatroom.save();
      logger.info(`Removed participant ${ws.userAid} from chatroom ${chatroomId} in DB`);
    } catch (err) {
      logger.error(`Error removing participant ${ws.userAid} from chatroom ${chatroomId}: ${err}`);
    }
  })();
}

wss.on('connection', (ws: WebSocket) => {
  const customWs = ws as CustomWebSocket;
  customWs.id = uuidv4();
  customWs.isAlive = true;
  customWs.syncing = false;
  customWs.messageQueue = [];
  clients.set(customWs.id, customWs);
  logger.info(`Client connected: ${customWs.id}. Total clients: ${clients.size}`);

  customWs.on('pong', () => {
    customWs.isAlive = true;
  });

  // Centralized parsed message handler that queues messages during initial sync
  async function handleParsedMessage(wsClient: CustomWebSocket, parsedMessage: any) {
    // If syncing (server is sending cached messages), queue incoming chat messages
    if (wsClient.syncing) {
      if (!wsClient.messageQueue) wsClient.messageQueue = [];
      wsClient.messageQueue.push(parsedMessage);
      return;
    }

    if (parsedMessage.type === 'joinChatroom' && parsedMessage.chatroomId && parsedMessage.userAid && parsedMessage.username) {
      wsClient.syncing = true;
      wsClient.userAid = parsedMessage.userAid;
      wsClient.username = parsedMessage.username;
      addClientToChatroom(parsedMessage.chatroomId, wsClient);

      const chatroom = await ChatRoom.findById(parsedMessage.chatroomId);
      if (!chatroom) {
        wsClient.send(JSON.stringify({ type: 'error', message: 'Chatroom not found' }));
        wsClient.syncing = false;
        return;
      }

      const participant = chatroom.participants.find(p => p.userAid === wsClient.userAid);
      const publicKey = participant?.publicKey;
      const exchangePublicKey = participant?.exchangePublicKey;

      wsClient.send(JSON.stringify({ 
        type: 'joinSuccess', 
        chatroomId: parsedMessage.chatroomId,
        participants: chatroom.participants.map(p => ({
          userAid: p.userAid,
          username: p.username,
          publicKey: p.publicKey,
          exchangePublicKey: p.exchangePublicKey
        }))
      }));

      // Notify other participants that a user has joined
      try {
        const chatroomClients = activeChatrooms.get(parsedMessage.chatroomId);
        if (chatroomClients) {
          const joinNotice = JSON.stringify({
            type: 'userJoined',
            chatroomId: parsedMessage.chatroomId,
            userAid: wsClient.userAid,
            username: wsClient.username,
            publicKey,
            exchangePublicKey,
            timestamp: new Date().toISOString(),
          });
          chatroomClients.forEach(client => {
            if (client.id === wsClient.id) return; // skip the joining client
            if (client.readyState === WebSocket.OPEN) {
              client.send(joinNotice);
            }
          });
        }
      } catch (err) {
        logger.error(`Failed to broadcast userJoined for ${wsClient.id}: ${err}`);
      }

      // Send cached messages to the newly joined client before processing other client messages
      try {
        const cachedMessages = await getCachedMessages(parsedMessage.chatroomId);
        for (const msg of cachedMessages) {
          wsClient.send(JSON.stringify({
            type: 'chatMessage',
            chatroomId: msg.chatroomId,
            senderAid: msg.senderAid || msg.senderId, // Support both for transition
            senderUsername: msg.senderUsername,
            content: msg.content,
            signature: msg.signature,
            timestamp: new Date(msg.timestamp).toISOString(),
          }));
        }
      } catch (err) {
        logger.error(`Failed to fetch/send cached messages for ${wsClient.id}: ${err}`);
      }

      wsClient.syncing = false;
      // Flush queued messages (if any) in order
      const queued = wsClient.messageQueue ? wsClient.messageQueue.splice(0) : [];
      for (const qm of queued) {
        await handleParsedMessage(wsClient, qm);
      }
      return;
    }

    // Handle leaving a chatroom
    if (parsedMessage.type === 'leaveChatroom' && parsedMessage.chatroomId) {
      if (wsClient.chatroomId === parsedMessage.chatroomId) {
        removeClientFromChatroom(parsedMessage.chatroomId, wsClient);
        wsClient.send(JSON.stringify({ type: 'leaveSuccess', chatroomId: parsedMessage.chatroomId }));
      } else {
        wsClient.send(JSON.stringify({ type: 'error', message: 'Not in the specified chatroom' }));
      }
      return;
    }

    // Handle sending a chat message
    if (parsedMessage.type === 'message' && parsedMessage.chatroomId && parsedMessage.content) {
      if (!wsClient.userAid || !wsClient.chatroomId) {
        logger.warn(`Message received from unauthenticated or unjoined client: ${wsClient.id}`);
        wsClient.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
        return;
      }

      const { chatroomId, content, signature } = parsedMessage;
      if (!mongoose.Types.ObjectId.isValid(chatroomId)) {
        logger.warn(`Invalid chatroomId received from ${wsClient.id}: ${chatroomId}`);
        wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid chatroom ID' }));
        return;
      }

      const chatroom = await ChatRoom.findById(chatroomId);
      if (!chatroom) {
        logger.warn(`Chatroom ${chatroomId} not found for message from ${wsClient.id}`);
        wsClient.send(JSON.stringify({ type: 'error', message: 'Chatroom not found' }));
        return;
      }

      // Verify signature if present
      if (signature) {
        const participant = chatroom.participants.find(p => p.userAid === wsClient.userAid);
        if (participant && participant.publicKey) {
          const isValid = verifySignature(content, signature, participant.publicKey);
          if (!isValid) {
            logger.warn(`Invalid signature from ${wsClient.userAid} in chatroom ${chatroomId}`);
            wsClient.send(JSON.stringify({ type: 'error', message: 'Invalid message signature' }));
            return;
          }
        }
      }

      const newMessage: IMessage = {
        _id: new mongoose.Types.ObjectId(),
        senderAid: wsClient.userAid,
        content,
        signature,
        timestamp: new Date(),
      };

      chatroom.messages.push(newMessage);
      await chatroom.save();

      addMessageToCache(chatroomId, {
        chatroomId: new mongoose.Types.ObjectId(chatroomId),
        senderAid: newMessage.senderAid,
        senderUsername: wsClient.username || 'Anonymous',
        content: newMessage.content,
        signature,
        timestamp: newMessage.timestamp,
      } as any);

      const chatroomClients = activeChatrooms.get(chatroomId);
      if (chatroomClients) {
        const messageToBroadcast = JSON.stringify({
          type: 'chatMessage',
          chatroomId,
          senderAid: wsClient.userAid,
          senderUsername: wsClient.username || 'Anonymous',
          content,
          signature,
          timestamp: newMessage.timestamp.toISOString(),
        });
        chatroomClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            if (client.bufferedAmount > 1024 * 1024) {
              logger.warn(`Backpressure: Client ${client.id} buffer is full. Skipping message.`);
              return;
            }
            client.send(messageToBroadcast);
          }
        });
      }
      return;
    }

    // Broadcast unknown message types to the chatroom (for client-side signaling like E2EE key exchange)
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
      return;
    }

    wsClient.send(JSON.stringify({ type: 'error', message: 'Unknown message type or invalid chatroom' }));
  }

  customWs.on('message', async message => {
    logger.info(`Received message from ${customWs.id}: ${message}`);
    try {
      const parsedMessage = JSON.parse(message.toString());
      await handleParsedMessage(customWs, parsedMessage);
    } catch (error) {
      logger.error(`Failed to parse or handle WebSocket message from ${customWs.id}: ${error}`);
      customWs.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  customWs.on('close', () => {
    clients.delete(customWs.id);
    if (customWs.chatroomId) {
      removeClientFromChatroom(customWs.chatroomId, customWs);
    }
    logger.info(`Client disconnected: ${customWs.id}. Total clients: ${clients.size}`);
  });
});

// Ping clients to keep connections alive
setInterval(() => {
  clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Every 30 seconds

// export { activeChatrooms };
