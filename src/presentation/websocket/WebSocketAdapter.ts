import * as fs from "node:fs";
import { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { AddReactionUseCase } from "../../application/use-cases/AddReaction";
import { DeleteMessageUseCase } from "../../application/use-cases/DeleteMessage";
import { EditMessageUseCase } from "../../application/use-cases/EditMessage";
import { GetChatroomDetailsUseCase } from "../../application/use-cases/GetChatroomDetails";
import { GetMessageHistoryUseCase } from "../../application/use-cases/GetMessageHistory";
import { JoinRoomUseCase } from "../../application/use-cases/JoinRoom";
import { LeaveRoomUseCase } from "../../application/use-cases/LeaveRoom";
import { SaveRoomKeyUseCase } from "../../application/use-cases/SaveRoomKey";
import { SendMessageUseCase } from "../../application/use-cases/SendMessage";
import { IdentityLogic } from "../../business/logic/IdentityLogic";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";
import { Events, IEventEmitter } from "../../events/IEventEmitter";

export class WebSocketAdapter {
    private wss: WebSocketServer | null = null;
    private readonly clients: Map<string, Set<WebSocket>> = new Map(); // conversationId -> Set of WebSockets
    private readonly wsIdentities: Map<WebSocket, { identityId: string, userAid: string, username: string }> = new Map(); // ws -> identity data
    private readonly wsRooms: Map<WebSocket, Set<string>> = new Map(); // ws -> set of conversationIds

    constructor(
        private readonly eventEmitter: IEventEmitter,
        private readonly sendMessageUseCase: SendMessageUseCase,
        private readonly joinRoomUseCase: JoinRoomUseCase,
        private readonly editMessageUseCase: EditMessageUseCase,
        private readonly deleteMessageUseCase: DeleteMessageUseCase,
        private readonly addReactionUseCase: AddReactionUseCase,
        private readonly getChatroomDetailsUseCase: GetChatroomDetailsUseCase,
        private readonly getMessageHistoryUseCase: GetMessageHistoryUseCase,
        private readonly saveRoomKeyUseCase: SaveRoomKeyUseCase,
        private readonly leaveRoomUseCase: LeaveRoomUseCase,
        private readonly sessionRepository: ISessionRepository,
        private readonly identityLogic: IdentityLogic
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
                case "saveRoomKey":
                    await this.handleSaveRoomKey(ws, message);
                    break;
                case "leaveChatroom":
                    this.handleLeaveRoom(ws, message);
                    break;
                case "typing":
                    this.handleTyping(ws, message);
                    break;
                case "roomKeyRequest":
                    this.handleRoomKeyRequest(ws, message);
                    break;
                case "roomKeyShare":
                    this.handleRoomKeyShare(ws, message);
                    break;
                case "rotateKey":
                    await this.handleRotateKey(ws, message);
                    break;
                case "ping":
                    ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
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
        if (!identityId) throw new Error("Authentication required to join room");
        const { chatroomId } = data;

        // 1. Persist participation
        const result = await this.joinRoomUseCase.execute({
            conversationId: chatroomId,
            identityId
        });
        
        const { userAid, username, publicKey, exchangePublicKey, allowedFeatures } = await this.identityLogic.getIdentityById(identityId);

        console.log(`[WS] Joining room: ${chatroomId} for user: ${userAid}`);
        
        this.wsIdentities.set(ws, { identityId, userAid, username: username || "Anonymous" });
        if (!this.wsRooms.has(ws)) {
            this.wsRooms.set(ws, new Set());
        }
        this.wsRooms.get(ws)!.add(chatroomId);

        // 2. Track connection for broadcasting
        if (!this.clients.has(chatroomId)) {
            this.clients.set(chatroomId, new Set());
        }
        this.clients.get(chatroomId)!.add(ws);

        // 3. Get room details and history
        console.log(`[WS] Fetching room details and history for ${chatroomId}`);
        const room = await this.getChatroomDetailsUseCase.execute({ chatroomId });
        const messages = await this.getMessageHistoryUseCase.execute({ conversationId: chatroomId, limit: 50 });
        console.log(`[WS] Details fetched. Sending joinSuccess for ${chatroomId}`);

        // Compute creator online status
        let isCreatorOnline = false;
        const sockets = this.clients.get(chatroomId);
        if (sockets) {
            for (const s of sockets.values()) {
                const idData = this.wsIdentities.get(s);
                if (idData?.userAid && idData.userAid === room.creatorAid) {
                    isCreatorOnline = true;
                    break;
                }
            }
        }

        // 4. Send joinSuccess to the joining client
        ws.send(JSON.stringify({
            type: "joinSuccess",
            chatroomId,
            encryptedRoomKey: room.encryptedRoomKey, // Ensure these are in the room object
            roomKeyIv: room.roomKeyIv,
            hostAid: room.hostAid,
            creatorAid: room.creatorAid,
            isCreatorOnline,
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
        if (!identityId) throw new Error("Authentication required to send message");
        const { chatroomId, content, signature } = data;

        await this.sendMessageUseCase.execute({
            conversationId: chatroomId,
            content,
            signature,
            identityId
        });
    }

    private async handleEditMessage(ws: WebSocket, data: any, identityId?: string) {
        if (!identityId) throw new Error("Authentication required to edit message");
        const { messageId, newContent } = data;
        await this.editMessageUseCase.execute({ messageId, content: newContent });
    }

    private async handleDeleteMessage(ws: WebSocket, data: any, identityId?: string) {
        if (!identityId) throw new Error("Authentication required to delete message");
        const { messageId } = data;
        await this.deleteMessageUseCase.execute({ messageId });
    }

    private async handleReaction(ws: WebSocket, data: any, identityId?: string) {
        if (!identityId) throw new Error("Authentication required to add reaction");
        const { messageId, emojiId, emojiValue, emojiType } = data;
        await this.addReactionUseCase.execute({
            messageId,
            identityId,
            emojiId,
            emojiValue,
            emojiType
        });
        // We broadcast reactions via event emitter (see setupEventListeners)
    }

    private handleTyping(ws: WebSocket, data: any) {
        const { chatroomId, userAid, username, isTyping } = data;
        if (!chatroomId || !userAid) return;

        this.broadcast(chatroomId, {
            type: "typing",
            chatroomId,
            userAid,
            username: username || "Anonymous",
            isTyping
        }, ws); // Don't send back to the sender
    }

    private async handleSaveRoomKey(ws: WebSocket, data: any) {
        const { chatroomId, encryptedKey, iv } = data;
        await this.saveRoomKeyUseCase.execute({ chatroomId, encryptedKey, iv });
        ws.send(JSON.stringify({ type: "saveRoomKeySuccess", chatroomId }));
    }

    private handleRoomKeyRequest(ws: WebSocket, data: any) {
        const { chatroomId } = data;
        const identityData = this.wsIdentities.get(ws);

        this.broadcastToOthers(chatroomId, ws, {
            type: "roomKeyRequest",
            chatroomId,
            senderAid: identityData?.userAid || data.senderAid
        });
    }

    private handleRoomKeyShare(ws: WebSocket, data: any) {
        const { chatroomId, targetAid, encryptedKey, iv } = data;
        const identityData = this.wsIdentities.get(ws);

        // Find the WebSocket for targetAid
        // For simplicity in this implementation, we broadcast to all in the room
        // Clients will filter based on targetAid
        this.broadcastToOthers(chatroomId, ws, {
            type: "roomKeyShare",
            chatroomId,
            senderAid: identityData?.userAid || data.senderAid,
            targetAid,
            encryptedKey,
            iv
        });
    }

    private async handleRotateKey(ws: WebSocket, data: any) {
        const { chatroomId, keys } = data as { chatroomId: string, keys: Record<string, { ciphertext: string, iv: string }> };
        if (!chatroomId || !keys) return;
        const identityData = this.wsIdentities.get(ws);
        const hostAid = identityData?.userAid;

        const sockets = this.clients.get(chatroomId);
        if (!sockets) return;

        sockets.forEach((clientWs) => {
            const idData = this.wsIdentities.get(clientWs);
            if (!idData?.userAid) return;
            const encryptedKey = keys[idData.userAid];
            if (!encryptedKey) return;
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: "rotateKey",
                    chatroomId,
                    hostAid,
                    encryptedKey
                }));
            }
        });
    }

    private async handleLeaveRoom(ws: WebSocket, data: any) {
        const { chatroomId } = data;
        const identityData = this.wsIdentities.get(ws);
        this.clients.get(chatroomId)?.delete(ws);

        if (identityData) {
            await this.leaveRoomUseCase.execute({ conversationId: chatroomId, identityId: identityData.identityId });
            this.wsRooms.get(ws)?.delete(chatroomId);

            // Broadcast userLeft
            this.broadcast(chatroomId, {
                type: "userLeft",
                chatroomId,
                userAid: identityData.userAid,
                username: identityData.username,
                timestamp: new Date().toISOString()
            });
        }
    }

    private async handleClose(ws: WebSocket) {
        this.clients.forEach((sockets) => sockets.delete(ws));

        const identityData = this.wsIdentities.get(ws);
        const rooms = this.wsRooms.get(ws);
        if (identityData && rooms) {
            for (const chatroomId of rooms) {
                await this.leaveRoomUseCase.execute({ conversationId: chatroomId, identityId: identityData.identityId });

                // Broadcast userLeft to each room
                this.broadcast(chatroomId, {
                    type: "userLeft",
                    chatroomId,
                    userAid: identityData.userAid,
                    username: identityData.username,
                    timestamp: new Date().toISOString()
                });
            }
        }
        this.wsIdentities.delete(ws);
        this.wsRooms.delete(ws);
    }

    private setupEventListeners() {
        this.eventEmitter.on(Events.MESSAGE_CREATED, (message) => {
            console.log(`[WS-Event] Broadcasting message to ${message.conversationId}`);
            this.broadcast(message.conversationId, {
                type: "chatMessage",
                messageId: message.id, // Client uses messageId or id
                senderAid: message.senderAid,
                senderUsername: message.senderUsername,
                content: message.content,
                timestamp: message.timestamp.toISOString ? message.timestamp.toISOString() : message.timestamp,
                isEdited: message.isEdited,
                isDeleted: message.isDeleted,
                replyTo: message.replyToId ? { messageId: message.replyToId } : null,
                reactions: message.reactions || []
            });
        });

        this.eventEmitter.on(Events.MESSAGE_EDITED, (data) => {
            if (data.conversationId) {
                this.broadcast(data.conversationId, {
                    type: "messageEdited",
                    ...data
                });
            }
        });

        this.eventEmitter.on(Events.MESSAGE_DELETED, (data) => {
            if (data.conversationId) {
                this.broadcast(data.conversationId, {
                    type: "messageDeleted",
                    ...data
                });
            }
        });

        this.eventEmitter.on(Events.REACTION_ADDED, (data) => {
            if (data.conversationId) {
                this.broadcast(data.conversationId, {
                    type: "reactionUpdate",
                    ...data
                });
            }
        });
    }

    private broadcastUpdate(messageId: string, data: any) {
        // Obsolete, we use targeted broadcast now
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

    private broadcast(chatroomId: string, data: any, excludeWs?: WebSocket) {
        const sockets = this.clients.get(chatroomId);
        if (sockets) {
            const payload = JSON.stringify(data);
            sockets.forEach((ws) => {
                if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            });
        }
    }
}
