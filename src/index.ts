import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { pinoHttp } from "pino-http";
import { PostgresConversationRepository } from "./data/repositories/PostgresConversationRepository";
import { PostgresIdentityRepository } from "./data/repositories/PostgresIdentityRepository";
import { PostgresMessageRepository } from "./data/repositories/PostgresMessageRepository";
import { PostgresApiKeyRepository } from "./data/repositories/PostgresApiKeyRepository";
import { PostgresParticipantRepository } from "./data/repositories/PostgresParticipantRepository";
import { PostgresSessionRepository } from "./data/repositories/PostgresSessionRepository";
import { RedisChallengeStore } from "./data/database/RedisChallengeStore";
import { ConversationLogic } from "./business/logic/ConversationLogic";
import { IdentityLogic } from "./business/logic/IdentityLogic";
import { MessageLogic } from "./business/logic/MessageLogic";
import { LocalEventEmitter } from "./events/publishers/LocalEventEmitter";
import { CreateRoomUseCase } from "./application/use-cases/CreateRoom";
import { SendMessageUseCase } from "./application/use-cases/SendMessage";
import { JoinRoomUseCase } from "./application/use-cases/JoinRoom";
import { GetMessageHistoryUseCase } from "./application/use-cases/GetMessageHistory";
import { GetPublicRoomsUseCase } from "./application/use-cases/GetPublicRooms";
import { GenerateChallengeUseCase } from "./application/use-cases/GenerateChallenge";
import { VerifyIdentityUseCase } from "./application/use-cases/VerifyIdentity";
import { ChatController } from "./presentation/controllers/ChatController";
import { AuthController } from "./presentation/controllers/AuthController";
import { WebSocketAdapter } from "./presentation/websocket/WebSocketAdapter";
import { chatRoutes } from "./presentation/routes/chatRoutes";
import { createAuthRoutes } from "./presentation/routes/authRoutes";
import { createAdminRoutes } from "./presentation/routes/adminRoutes";
import { AdminController } from "./presentation/controllers/AdminController";

import { EditMessageUseCase } from "./application/use-cases/EditMessage";
import { DeleteMessageUseCase } from "./application/use-cases/DeleteMessage";
import { AddReactionUseCase } from "./application/use-cases/AddReaction";
import { GetChatroomDetailsUseCase } from "./application/use-cases/GetChatroomDetails";
import { SSEService } from "./presentation/sse/SSEService";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors());
app.use(pinoHttp());

// Dependency Injection Container
const conversationRepo = new PostgresConversationRepository();
const identityRepo = new PostgresIdentityRepository();
const messageRepo = new PostgresMessageRepository();
const apiKeyRepo = new PostgresApiKeyRepository();
const participantRepo = new PostgresParticipantRepository();
const sessionRepo = new PostgresSessionRepository();
const challengeStore = new RedisChallengeStore();

const conversationLogic = new ConversationLogic(conversationRepo);
const identityLogic = new IdentityLogic(identityRepo);
const messageLogic = new MessageLogic(messageRepo);

const eventEmitter = new LocalEventEmitter();
const getPublicRoomsUseCase = new GetPublicRoomsUseCase(conversationRepo);
const sseService = new SSEService(eventEmitter, getPublicRoomsUseCase);

const createRoomUseCase = new CreateRoomUseCase(conversationLogic, identityLogic, eventEmitter);
const sendMessageUseCase = new SendMessageUseCase(messageLogic, identityLogic, eventEmitter);
const joinRoomUseCase = new JoinRoomUseCase(conversationRepo, identityRepo, participantRepo);
const getMessageHistoryUseCase = new GetMessageHistoryUseCase(messageRepo, conversationRepo);
const getChatroomDetailsUseCase = new GetChatroomDetailsUseCase(conversationRepo, participantRepo, identityRepo);
const editMessageUseCase = new EditMessageUseCase(messageLogic, eventEmitter);
const deleteMessageUseCase = new DeleteMessageUseCase(messageLogic, eventEmitter);
const addReactionUseCase = new AddReactionUseCase(messageLogic, identityLogic, eventEmitter);

const generateChallengeUseCase = new GenerateChallengeUseCase(challengeStore);
const verifyIdentityUseCase = new VerifyIdentityUseCase(challengeStore, sessionRepo, identityRepo);

const chatController = new ChatController(
    createRoomUseCase,
    sendMessageUseCase,
    joinRoomUseCase,
    getMessageHistoryUseCase,
    getPublicRoomsUseCase,
    getChatroomDetailsUseCase,
    sseService
);

const authController = new AuthController(generateChallengeUseCase, verifyIdentityUseCase);
const adminController = new AdminController(apiKeyRepo);

const wsAdapter = new WebSocketAdapter(
    eventEmitter,
    sendMessageUseCase,
    joinRoomUseCase,
    editMessageUseCase,
    deleteMessageUseCase,
    addReactionUseCase,
    getChatroomDetailsUseCase,
    getMessageHistoryUseCase,
    sessionRepo
);

app.use("/api/v1/auth", createAuthRoutes(authController, sessionRepo));
app.use("/api/v1/admin", createAdminRoutes(adminController));
app.use("/api/v1", chatRoutes(chatController, apiKeyRepo, sessionRepo));

wsAdapter.listen(server);

server.listen(PORT, () => {
    console.log(`Anonfly Service running on port ${PORT}`);
});
