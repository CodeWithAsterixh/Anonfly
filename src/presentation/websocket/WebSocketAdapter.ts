import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { IEventEmitter, Events } from "../../events/IEventEmitter";
import { SendMessageUseCase } from "../../application/use-cases/SendMessage";
import { JoinRoomUseCase } from "../../application/use-cases/JoinRoom";
import { EditMessageUseCase } from "../../application/use-cases/EditMessage";
import { DeleteMessageUseCase } from "../../application/use-cases/DeleteMessage";
import { AddReactionUseCase } from "../../application/use-cases/AddReaction";
import { GetChatroomDetailsUseCase } from "../../application/use-cases/GetChatroomDetails";
import { GetMessageHistoryUseCase } from "../../application/use-cases/GetMessageHistory";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";

export class WebSocketAdapter {
    private wss: WebSocketServer | null = null;
    private clients: Map<string, Set<WebSocket>> = new Map(); // conversationId -> Set of WebSockets

    constructor(
        private readonly eventEmitter: IEventEmitter,
        private readonly sendMessageUseCase: SendMessageUseCase,
        private readonly joinRoomUseCase: JoinRoomUseCase,
        private readonly editMessageUseCase: EditMessageUseCase,
        private readonly deleteMessageUseCase: DeleteMessageUseCase,
        private readonly addReactionUseCase: AddReactionUseCase,
        private readonly getChatroomDetailsUseCase: GetChatroomDetailsUseCase,
        private readonly getMessageHistoryUseCase: GetMessageHistoryUseCase,
        private readonly sessionRepository: ISessionRepository
    ) {
        this.setupEventListeners();
    }

    public listen(server: Server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on("connection", (ws: WebSocket) => {
            console.log("New WS connection");

            ws.on("message", (data: string) => this.handleMessage(ws, data));
            ws.on("close", () => this.handleClose(ws));
        });
    }

    private async handleMessage(ws: WebSocket, data: string) {
        try {
            const message = JSON.parse(data);
            const { type, token } = message;

            // Optional: Authenticate every WS message if token provided
            let identityId: string | undefined;
            if (token) {
                const session = await this.sessionRepository.findByToken(token);
                if (session) {
                    identityId = session.identityId;
                }
            }

            switch (type) {
                case "joinChatroom":
                    await this.handleJoinRoom(ws, message, identityId);
                    break;
                case "message":
                    await this.handleChatMessage(ws, message, identityId);
                    break;
                case "editMessage":
                    await this.handleEditMessage(ws, message, identityId);
                    break;
                case "deleteMessage":
                    await this.handleDeleteMessage(ws, message, identityId);
                    break;
                case "reaction":
                    await this.handleReaction(ws, message, identityId);
                    break;
                case "leaveChatroom":
                    this.handleLeaveRoom(ws, message);
                    break;
                default:
                    console.log("Unknown WS message type:", type);
            }
        } catch (error: any) {
            fs.appendFileSync("ws_error.txt", `[${new Date().toISOString()}] WS Error: ${error.message}\n${error.stack}\n---\n`);
            ws.send(JSON.stringify({ type: "error", message: error.message }));
        }
    }

    private async handleJoinRoom(ws: WebSocket, data: any, identityId?: string) {
        const { chatroomId, userAid, username, publicKey, exchangePublicKey, allowedFeatures } = data;

        // 1. Ensure/Update participant using UseCase
        await this.joinRoomUseCase.execute({
            conversationId: chatroomId,
            userAid,
            username,
            identityId
        });

        // 2. Track connection for broadcasting
        if (!this.clients.has(chatroomId)) {
            this.clients.set(chatroomId, new Set());
        }
        this.clients.get(chatroomId)!.add(ws);

        // 3. Get room details and history
        const room = await this.getChatroomDetailsUseCase.execute({ chatroomId });
        const messages = await this.getMessageHistoryUseCase.execute({ conversationId: chatroomId, limit: 50 });

        // 4. Send joinSuccess to the joining client
        ws.send(JSON.stringify({
            type: "joinSuccess",
            chatroomId,
            encryptedRoomKey: room.encryptedRoomKey, // Ensure these are in the room object
            roomKeyIv: room.roomKeyIv,
            hostAid: room.hostAid,
            creatorAid: room.creatorAid,
            isCreatorOnline: true, // Simplified
            participants: room.participants,
            cachedMessages: messages.map(m => ({
                id: m.id,
                type: "message",
                senderAid: m.senderAid,
                senderUsername: m.senderUsername,
                content: m.content,
                timestamp: m.timestamp.toISOString(),
                isEdited: m.isEdited,
                isDeleted: m.isDeleted,
                reactions: m.reactions
            }))
        }));

        // 5. Broadcast userJoined to others
        this.broadcastToOthers(chatroomId, ws, {
            type: "userJoined",
            chatroomId,
            userAid,
            username,
            publicKey,
            exchangePublicKey,
            allowedFeatures,
            timestamp: new Date().toISOString(),
            isCreator: room.creatorAid === userAid
        });
    }

    private async handleChatMessage(ws: WebSocket, data: any, identityId?: string) {
        const { chatroomId, content, userAid, username, signature } = data;

        await this.sendMessageUseCase.execute({
            conversationId: chatroomId,
            senderAid: userAid,
            username,
            content,
            signature,
            identityId
        });
    }

    private async handleEditMessage(ws: WebSocket, data: any, identityId?: string) {
        const { messageId, newContent } = data;
        await this.editMessageUseCase.execute({ messageId, content: newContent });
    }

    private async handleDeleteMessage(ws: WebSocket, data: any, identityId?: string) {
        const { messageId } = data;
        await this.deleteMessageUseCase.execute({ messageId });
    }

    private async handleReaction(ws: WebSocket, data: any, identityId?: string) {
        const { messageId, userAid, emojiId, emojiValue, emojiType } = data;
        await this.addReactionUseCase.execute({
            messageId,
            userAid,
            emojiId,
            emojiValue,
            emojiType
        });
    }

    private handleLeaveRoom(ws: WebSocket, data: any) {
        const { chatroomId } = data;
        this.clients.get(chatroomId)?.delete(ws);
    }

    private handleClose(ws: WebSocket) {
        this.clients.forEach((sockets) => sockets.delete(ws));
    }

    private setupEventListeners() {
        this.eventEmitter.on(Events.MESSAGE_CREATED, (message) => {
            this.broadcast(message.conversationId, {
                type: "message",
                id: message.id,
                senderAid: message.senderAid,
                senderUsername: message.senderUsername,
                content: message.content,
                timestamp: message.timestamp.toISOString(),
                isEdited: message.isEdited,
                isDeleted: message.isDeleted,
                replyTo: message.replyToId ? { messageId: message.replyToId } : null,
                reactions: message.reactions || []
            });
        });

        this.eventEmitter.on(Events.MESSAGE_EDITED, (data) => {
            this.broadcastUpdate(data.messageId, {
                type: "editMessage",
                ...data
            });
        });

        this.eventEmitter.on(Events.MESSAGE_DELETED, (data) => {
            this.broadcastUpdate(data.messageId, {
                type: "deleteMessage",
                ...data
            });
        });

        this.eventEmitter.on(Events.REACTION_ADDED, (data) => {
            this.broadcastUpdate(data.messageId, {
                type: "reaction",
                ...data
            });
        });
    }

    private broadcastUpdate(messageId: string, data: any) {
        // Since we don't track which message belongs to which room globally here, 
        // we might need to find the room for the message first if we want targeted broadcast.
        // For now, let's assume we can broadcast to all for simplicity or find room if possible.
        // Actually, we should probably include chatroomId in the events.

        // Let's broadcast to all rooms for now as a fallback, 
        // but better to have chatroomId in the event.
        this.clients.forEach((sockets, chatroomId) => {
            this.broadcast(chatroomId, data);
        });
    }

    private broadcastToOthers(chatroomId: string, senderWs: WebSocket, data: any) {
        const sockets = this.clients.get(chatroomId);
        if (sockets) {
            const payload = JSON.stringify(data);
            sockets.forEach((ws) => {
                if (ws !== senderWs && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            });
        }
    }

    private broadcast(chatroomId: string, data: any) {
        const sockets = this.clients.get(chatroomId);
        if (sockets) {
            const payload = JSON.stringify(data);
            sockets.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            });
        }
    }
}
