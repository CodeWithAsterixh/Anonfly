// Core express dependencies
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { WebSocketServer } from 'ws';
import { pinoHttp } from 'pino-http';
import env from "../lib/constants/env";
import useRouter from "../lib/middlewares/routeHandler";
import helmetMiddleware from "../lib/middlewares/securityHeaders";
import loggers from "../lib/middlewares/logger";

// Increase max listeners to prevent warnings from multiple pino instances/connections
process.setMaxListeners(20);


// Routes
import chatroomListRouter from "./routes/chatroom/chatroomlist";
import createChatroomRoute from "./routes/chatroom/createChatroom";
import getChatroomMessagesRoute from "./routes/chatroom/getChatroomMessages";
import joinChatroomRoute from "./routes/chatroom/joinChatroom";
import deleteChatroomRoute from "./routes/chatroom/deleteChatroom";
import getChatroomDetailsRoute from "./routes/chatroom/getChatroomDetails";
import editChatroomRoute from "./routes/chatroom/editChatroom";
import leaveChatroomRoute from "./routes/chatroom/leaveChatroom";
import generateShareLinkRoute from "./routes/chatroom/generateShareLink";
import validateShareLinkRoute from "./routes/chatroom/validateShareLink";
import checkAccessRoute from "./routes/chatroom/checkAccess";
import deleteMessageRoute from "./routes/chatroom/deleteMessage"; // Import the new route
import removeParticipantRoute from "./routes/chatroom/removeParticipant";
import banParticipantRoute from "./routes/chatroom/banParticipant";
import unbanParticipantRoute from "./routes/chatroom/unbanParticipant";
import chatroomSSERoute from "./routes/chatroom/chatroomSSE";
import challengeRoute from "./routes/auth/challenge";
import verifyRoute from "./routes/auth/verify";
import premiumRoute from "./routes/auth/premium";
import getMyModerationTokenRoute from "./routes/auth/getModerationToken";

import homeRoute from "./routes/homeRoute";
import healthzRoute from "./routes/healthzRoute";

import { setupWebSocketServer } from '../lib/services/websocket/connectionManager';

import { rateLimiter } from "../lib/middlewares/rateLimiter";
import helmet from "helmet";

// App setup
const app = express();

// Enable Helmet
app.use(helmet());

const PORT = process.env.PORT || 5000;

// Use centralized logger
const logger = loggers.app;

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

// Security: Rate limiting for all routes
app.use(rateLimiter()); // Global limit: 100 requests per minute

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
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));


const router = useRouter(app);

app.use('/', chatroomListRouter);
app.use('/', chatroomSSERoute);



// Routes
router(homeRoute);
router(healthzRoute);

router(createChatroomRoute);

router(getChatroomMessagesRoute);

router(deleteMessageRoute); // Use the new route

router(challengeRoute);
router(verifyRoute);
router(premiumRoute);
router(getMyModerationTokenRoute);

router(joinChatroomRoute);

router(getChatroomDetailsRoute);

router(deleteChatroomRoute);
router(editChatroomRoute);

router(leaveChatroomRoute);
router(generateShareLinkRoute);
router(validateShareLinkRoute);
router(checkAccessRoute);
router(removeParticipantRoute);
router(banParticipantRoute);
router(unbanParticipantRoute);

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// WebSocket Server with security limits
const wss = new WebSocketServer({ 
  server,
  maxPayload: 1024 * 100 // 100KB max message size to prevent DoS
});

// Initialize WebSocket Server
setupWebSocketServer(wss);

