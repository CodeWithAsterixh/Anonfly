import cors from "cors";
import "dotenv/config";
import express from "express";
import http from "node:http";
import { pinoHttp } from "pino-http";
import { CreateRoomUseCase } from "./application/use-cases/CreateRoom";
import { GenerateChallengeUseCase } from "./application/use-cases/GenerateChallenge";
import { GetMessageHistoryUseCase } from "./application/use-cases/GetMessageHistory";
import { GetPublicRoomsUseCase } from "./application/use-cases/GetPublicRooms";
import { JoinRoomUseCase } from "./application/use-cases/JoinRoom";
import { LeaveRoomUseCase } from "./application/use-cases/LeaveRoom";
import { SendMessageUseCase } from "./application/use-cases/SendMessage";
import { VerifyIdentityUseCase } from "./application/use-cases/VerifyIdentity";
import { ConversationLogic } from "./business/logic/ConversationLogic";
import { IdentityLogic } from "./business/logic/IdentityLogic";
import { MessageLogic } from "./business/logic/MessageLogic";
import { RedisChallengeStore } from "./data/database/RedisChallengeStore";
import { PostgresApiKeyRepository } from "./data/repositories/PostgresApiKeyRepository";
import { PostgresConversationRepository } from "./data/repositories/PostgresConversationRepository";
import { PostgresIdentityRepository } from "./data/repositories/PostgresIdentityRepository";
import { PostgresMessageRepository } from "./data/repositories/PostgresMessageRepository";
import { PostgresParticipantRepository } from "./data/repositories/PostgresParticipantRepository";
import { PostgresSessionRepository } from "./data/repositories/PostgresSessionRepository";
import { LocalEventEmitter } from "./events/publishers/LocalEventEmitter";
import { AdminController } from "./presentation/controllers/AdminController";
import { AuthController } from "./presentation/controllers/AuthController";
import { ChatController } from "./presentation/controllers/ChatController";
import { createAdminRoutes } from "./presentation/routes/adminRoutes";
import { createAuthRoutes } from "./presentation/routes/authRoutes";
import { chatRoutes } from "./presentation/routes/chatRoutes";
import { WebSocketAdapter } from "./presentation/websocket/WebSocketAdapter";

import { AddReactionUseCase } from "./application/use-cases/AddReaction";
import { DeleteMessageUseCase } from "./application/use-cases/DeleteMessage";
import { EditMessageUseCase } from "./application/use-cases/EditMessage";
import { GetChatroomDetailsUseCase } from "./application/use-cases/GetChatroomDetails";
import { SaveRoomKeyUseCase } from "./application/use-cases/SaveRoomKey";
import { SSEService } from "./presentation/sse/SSEService";

import { RedeemVoucherUseCase } from "./application/use-cases/RedeemVoucher";
import { PostgresTransactionRepository } from "./data/repositories/PostgresTransactionRepository";
import { PostgresVoucherRepository } from "./data/repositories/PostgresVoucherRepository";
import { PaymentController } from "./presentation/controllers/PaymentController";
import { createPaymentRoutes } from "./presentation/routes/paymentRoutes";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

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
const transactionRepo = new PostgresTransactionRepository();
const voucherRepo = new PostgresVoucherRepository();

const conversationLogic = new ConversationLogic(conversationRepo);
const identityLogic = new IdentityLogic(identityRepo);
const messageLogic = new MessageLogic(messageRepo);

const eventEmitter = new LocalEventEmitter();
const getPublicRoomsUseCase = new GetPublicRoomsUseCase(conversationRepo, participantRepo);
const sseService = new SSEService(eventEmitter, getPublicRoomsUseCase);

const createRoomUseCase = new CreateRoomUseCase(conversationLogic, identityLogic, eventEmitter);
const sendMessageUseCase = new SendMessageUseCase(messageLogic, identityLogic, eventEmitter);
const joinRoomUseCase = new JoinRoomUseCase(conversationRepo, identityRepo, participantRepo, eventEmitter);
const getMessageHistoryUseCase = new GetMessageHistoryUseCase(messageRepo, conversationRepo);
const getChatroomDetailsUseCase = new GetChatroomDetailsUseCase(conversationRepo, participantRepo, identityRepo);
const editMessageUseCase = new EditMessageUseCase(messageLogic, eventEmitter);
const deleteMessageUseCase = new DeleteMessageUseCase(messageLogic, eventEmitter);
const addReactionUseCase = new AddReactionUseCase(messageLogic, identityLogic, eventEmitter);
const saveRoomKeyUseCase = new SaveRoomKeyUseCase(conversationRepo);
const leaveRoomUseCase = new LeaveRoomUseCase(participantRepo, eventEmitter);

const generateChallengeUseCase = new GenerateChallengeUseCase(challengeStore);
const verifyIdentityUseCase = new VerifyIdentityUseCase(challengeStore, sessionRepo, identityRepo);
const redeemVoucherUseCase = new RedeemVoucherUseCase(voucherRepo, identityRepo, eventEmitter);

const chatController = new ChatController(
    createRoomUseCase,
    sendMessageUseCase,
    joinRoomUseCase,
    getMessageHistoryUseCase,
    getPublicRoomsUseCase,
    getChatroomDetailsUseCase,
    sseService
);

const authController = new AuthController(generateChallengeUseCase, verifyIdentityUseCase, identityRepo);
const adminController = new AdminController(apiKeyRepo);
const paymentController = new PaymentController(redeemVoucherUseCase, transactionRepo, voucherRepo);

const wsAdapter = new WebSocketAdapter(
    eventEmitter,
    sendMessageUseCase,
    joinRoomUseCase,
    editMessageUseCase,
    deleteMessageUseCase,
    addReactionUseCase,
    getChatroomDetailsUseCase,
    getMessageHistoryUseCase,
    saveRoomKeyUseCase,
    leaveRoomUseCase,
    sessionRepo,
    identityLogic
);

app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use("/api/v1/auth", createAuthRoutes(authController, sessionRepo));
app.use("/api/v1/admin", createAdminRoutes(adminController));
app.use("/api/v1/payments", createPaymentRoutes(paymentController, sessionRepo));
app.use("/api/v1", chatRoutes(chatController, apiKeyRepo, sessionRepo));

wsAdapter.listen(server);

server.listen(PORT, () => {
    console.log(`Anonfly Service running on port ${PORT}`);
});
