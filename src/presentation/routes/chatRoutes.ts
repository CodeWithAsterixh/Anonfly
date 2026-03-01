import { Router } from "express";
import { ChatController } from "../controllers/ChatController";
import { apiKeyAuth } from "../../auth/apikey/middleware";
import { sessionAuth } from "../../auth/session/middleware";
import { IApiKeyRepository } from "../../business/logic/interfaces/IApiKeyRepository";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";

export const chatRoutes = (
    chatController: ChatController,
    apiKeyRepo: IApiKeyRepository,
    sessionRepo: ISessionRepository
): Router => {
    const router = Router();

    // Public routes
    router.get("/chatrooms", (req, res) => chatController.getPublicRooms(req, res));
    router.get("/chatroom/:chatroomId/details", (req, res) => chatController.getChatroomDetails(req, res));
    router.get("/chatroom/:chatroomId/details/sse", (req, res) => chatController.getRoomDetailsSSE(req, res));
    router.post("/chatroom/:chatroomId/check-access", sessionAuth(sessionRepo), (req, res) => chatController.checkAccess(req, res));

    // Protected by session (Client-facing)
    router.post("/chatrooms", sessionAuth(sessionRepo), (req, res) => chatController.createRoom(req, res));
    router.post("/chatrooms/:chatroomId/join", sessionAuth(sessionRepo), (req, res) => chatController.joinRoom(req, res));
    router.get("/chatrooms/:chatroomId/messages", (req, res) => chatController.getMessages(req, res));
    router.post("/chatrooms/:chatroomId/messages", sessionAuth(sessionRepo), (req, res) => chatController.sendMessage(req, res));

    // Protected by API Key (Service-to-Service)
    // You can add more service-to-service routes here if needed
    // router.use(apiKeyAuth(apiKeyRepo)); 

    return router;
};
