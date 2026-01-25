// Core express dependencies
import cors from "cors";
import express from "express";
import { pinoHttp } from 'pino-http';
import { WebSocketServer } from 'ws';
import env from "../lib/constants/env";
import loggers from "../lib/middlewares/logger";
import useRouter from "../lib/middlewares/routeHandler";
import helmetMiddleware from "../lib/middlewares/securityHeaders";

// Increase max listeners to prevent warnings from multiple pino instances/connections
process.setMaxListeners(20);


// Routes
import challengeRoute from "./routes/auth/challenge";
import getMyModerationTokenRoute from "./routes/auth/getModerationToken";
import premiumRoute from "./routes/auth/premium";
import verifyRoute from "./routes/auth/verify";
import banParticipantRoute from "./routes/chatroom/banParticipant";
import chatroomListRouter from "./routes/chatroom/chatroomlist";
import chatroomSSERoute from "./routes/chatroom/chatroomSSE";
import checkAccessRoute from "./routes/chatroom/checkAccess";
import createChatroomRoute from "./routes/chatroom/createChatroom";
import deleteChatroomRoute from "./routes/chatroom/deleteChatroom";
import deleteMessageRoute from "./routes/chatroom/deleteMessage"; // Import the new route
import editChatroomRoute from "./routes/chatroom/editChatroom";
import generateShareLinkRoute from "./routes/chatroom/generateShareLink";
import getChatroomDetailsRoute from "./routes/chatroom/getChatroomDetails";
import getChatroomMessagesRoute from "./routes/chatroom/getChatroomMessages";
import joinChatroomRoute from "./routes/chatroom/joinChatroom";
import leaveChatroomRoute from "./routes/chatroom/leaveChatroom";
import removeParticipantRoute from "./routes/chatroom/removeParticipant";
import unbanParticipantRoute from "./routes/chatroom/unbanParticipant";
import validateShareLinkRoute from "./routes/chatroom/validateShareLink";

import healthzRoute from "./routes/healthzRoute";
import homeRoute from "./routes/homeRoute";

import { setupWebSocketServer } from '../lib/services/websocket/connectionManager';

import helmet from "helmet";
import { rateLimiter } from "../lib/middlewares/rateLimiter";

// App setup
const app = express();

// Trust proxy for rate limiting behind load balancers/proxies
app.set('trust proxy', 1);

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

const prodAllowedDomain = env.ALLOWEDDOMAIN ? env.ALLOWEDDOMAIN.split(",").map(o => o.trim()) : []
// CORS configuration with strict options
app.use(cors({
  origin: env.NODE_ENV === 'production' 
    ? (prodAllowedDomain)
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

