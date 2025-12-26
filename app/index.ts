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
import env from "../lib/constants/env.ts";
import useRouter from "../lib/middlewares/routeHandler.ts";
import helmetMiddleware from "../lib/middlewares/securityHeaders.ts";
import withErrorHandling from "../lib/middlewares/withErrorHandling.ts";
import { addMessageToCache, getCachedMessages } from '../lib/helpers/messageCache.ts';
import ChatRoom, { type IMessage } from '../lib/models/chatRoom.ts';

// Routes
import chatroomListRouter from "./routes/chatroom/chatroomlist.ts";
import createChatroomRoute from "./routes/chatroom/createChatroom.ts";
import getChatroomMessagesRoute from "./routes/chatroom/getChatroomMessages.ts";
import joinChatroomRoute from "./routes/chatroom/joinChatroom.ts";
import deleteChatroomRoute from "./routes/chatroom/deleteChatroom.ts";
import getChatroomDetailsRoute from "./routes/chatroom/getChatroomDetails.ts";
import leaveChatroomRoute from "./routes/chatroom/leaveChatroom.ts";
import deleteMessageRoute from "./routes/chatroom/deleteMessage.ts"; // Import the new route
import createUserRoute from "./routes/user/createUser.ts";
import loginRoute from "./routes/auth/login.ts";
import getUserRoute from "./routes/auth/getUser.ts";
import deleteUserRoute from "./routes/user/deleteUser.ts";

import homeRoute from "./routes/homeRoute.ts";
import healthzRoute from "./routes/healthzRoute.ts";

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
    ? (env.ALLOWEDDOMAIN ? env.ALLOWEDDOMAIN.split(",") : [])
    : ['http://localhost:8000', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parsers with appropriate limits
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));


const router = useRouter(app);

app.use('/', chatroomListRouter);



// Routes
router(homeRoute);
router(healthzRoute);

router(createChatroomRoute);

router(getChatroomMessagesRoute);

router(deleteMessageRoute); // Use the new route

router(createUserRoute);

router(loginRoute);

router(getUserRoute);

router(deleteUserRoute);

router(joinChatroomRoute);

router(getChatroomDetailsRoute);

router(deleteChatroomRoute);

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
  userId?: string; // Optional: to store the authenticated user's ID
  chatroomId?: string; // Optional: to store the chatroom the user is in
  username?: string; // Optional: to store the authenticated user's username
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
}

wss.on('connection', (ws: WebSocket) => {
  const customWs = ws as CustomWebSocket;
  customWs.id = uuidv4();
  customWs.isAlive = true;
  clients.set(customWs.id, customWs);
  logger.info(`Client connected: ${customWs.id}. Total clients: ${clients.size}`);

  customWs.on('pong', () => {
    customWs.isAlive = true;
  });

  customWs.on('message', async message => {
    logger.info(`Received message from ${customWs.id}: ${message}`);
    try {
      const parsedMessage = JSON.parse(message.toString());
      // For now, let's assume a simple message format for chat
      // { type: "chatMessage", chatroomId: "abc", content: "Hello" }
      if (parsedMessage.type === 'message' && parsedMessage.chatroomId && parsedMessage.content) {
        // Authenticate the user for this message (this is a placeholder for actual auth)
        // For now, we'll assume the userId and username are already on the customWs object after initial auth
        if (!customWs.userId || !customWs.chatroomId) {
          logger.warn(`Message received from unauthenticated or unjoined client: ${customWs.id}`);
          customWs.send(JSON.stringify({ type: 'error', message: 'Not authenticated or not in a chatroom' }));
          return;
        }

        const { chatroomId, content } = parsedMessage;

        if (!mongoose.Types.ObjectId.isValid(chatroomId)) {
          logger.warn(`Invalid chatroomId received from ${customWs.id}: ${chatroomId}`);
          customWs.send(JSON.stringify({ type: 'error', message: 'Invalid chatroom ID' }));
          return;
        }
        if (!mongoose.Types.ObjectId.isValid(customWs.userId)) {
          logger.warn(`Invalid userId on customWs from ${customWs.id}: ${customWs.userId}`);
          customWs.send(JSON.stringify({ type: 'error', message: 'Invalid user ID' }));
          return;
        }

        const newMessage: IMessage = {
          _id: new mongoose.Types.ObjectId(), // Generate a new ObjectId for the embedded message
          senderUserId: new mongoose.Types.ObjectId(customWs.userId),
          content,
          timestamp: new Date(),
        };

        // Find the chatroom and push the new message
        const chatroom = await ChatRoom.findById(chatroomId);
        if (!chatroom) {
          logger.warn(`Chatroom ${chatroomId} not found for message from ${customWs.id}`);
          customWs.send(JSON.stringify({ type: 'error', message: 'Chatroom not found' }));
          return;
        }
        chatroom.messages.push(newMessage);
        await chatroom.save();

        // Add message to cache
        addMessageToCache(chatroomId, {
          chatroomId: new mongoose.Types.ObjectId(chatroomId),
          senderId: newMessage.senderUserId,
          senderUsername: customWs.username || 'Anonymous',
          content: newMessage.content,
          timestamp: newMessage.timestamp,
        } as any);

        // Broadcast message to all clients in the chatroom
        const chatroomClients = activeChatrooms.get(chatroomId);
        if (chatroomClients) {
          const messageToBroadcast = JSON.stringify({
            type: 'chatMessage',
            chatroomId,
            senderId: customWs.userId,
            senderUsername: customWs.username || 'Anonymous',
            content,
            timestamp: new Date().toISOString(),
          });
          chatroomClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              // Implement backpressure handling here
              if (client.bufferedAmount > 1024 * 1024) { // If buffer is > 1MB
                logger.warn(`Backpressure: Client ${client.id} buffer is full. Skipping message.`);
                // Optionally, terminate connection or send error to client
                return;
              }
              client.send(messageToBroadcast);
            }
          });
        }
      } else if (parsedMessage.type === 'joinChatroom' && parsedMessage.chatroomId && parsedMessage.userId && parsedMessage.username) {
        // This is a simplified join logic. In a real app, this would involve JWT verification
        // and checking if the user is allowed to join the chatroom.
        customWs.userId = parsedMessage.userId;
        customWs.username = parsedMessage.username;
        addClientToChatroom(parsedMessage.chatroomId, customWs);
        customWs.send(JSON.stringify({ type: 'joinSuccess', chatroomId: parsedMessage.chatroomId }));

        // Send cached messages to the newly joined client
        const cachedMessages = await getCachedMessages(parsedMessage.chatroomId);
        cachedMessages.forEach(msg => {
          customWs.send(JSON.stringify({
            type: 'chatMessage',
            chatroomId: msg.chatroomId,
            senderId: msg.senderId,
            senderUsername: msg.senderUsername,
            content: msg.content,
            timestamp: new Date(msg.timestamp).toISOString(), // Convert timestamp string to Date object
          }));
        });
      } else if (parsedMessage.type === 'leaveChatroom' && parsedMessage.chatroomId) {
        if (customWs.chatroomId === parsedMessage.chatroomId) {
          removeClientFromChatroom(parsedMessage.chatroomId, customWs);
          customWs.send(JSON.stringify({ type: 'leaveSuccess', chatroomId: parsedMessage.chatroomId }));
        } else {
          customWs.send(JSON.stringify({ type: 'error', message: 'Not in the specified chatroom' }));
        }
      }
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
