import { Request, Response } from "express";
import { CreateRoomUseCase } from "../../application/use-cases/CreateRoom";
import { SendMessageUseCase } from "../../application/use-cases/SendMessage";
import { JoinRoomUseCase } from "../../application/use-cases/JoinRoom";
import { GetMessageHistoryUseCase } from "../../application/use-cases/GetMessageHistory";
import { GetPublicRoomsUseCase } from "../../application/use-cases/GetPublicRooms";

import { GetChatroomDetailsUseCase } from "../../application/use-cases/GetChatroomDetails";
import { SSEService } from "../sse/SSEService";

export class ChatController {
    constructor(
        private readonly createRoomUseCase: CreateRoomUseCase,
        private readonly sendMessageUseCase: SendMessageUseCase,
        private readonly joinRoomUseCase: JoinRoomUseCase,
        private readonly getMessageHistoryUseCase: GetMessageHistoryUseCase,
        private readonly getPublicRoomsUseCase: GetPublicRoomsUseCase,
        private readonly getChatroomDetailsUseCase: GetChatroomDetailsUseCase,
        private readonly sseService: SSEService
    ) { }

    async createRoom(req: Request, res: Response) {
        try {
            const session = (req as any).session;
            const hostAid = session?.identityAid;
            const { roomname, password, ...rest } = req.body;
            const result = await this.createRoomUseCase.execute({
                ...rest,
                roomName: roomname,
                passwordHash: password,
                hostAid
            });
            res.status(201).json({
                success: true,
                status: "good",
                statusCode: 201,
                message: "Chatroom created successfully",
                data: {
                    id: result.id,
                    roomname: result.roomName,
                    isPrivate: result.isPrivate
                }
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }

    async sendMessage(req: Request, res: Response) {
        try {
            const { chatroomId } = req.params;
            const session = (req as any).session;
            const identityId = session?.identityId;
            const result = await this.sendMessageUseCase.execute({ ...req.body, conversationId: chatroomId, identityId });
            res.status(201).json({
                success: true,
                status: "good",
                statusCode: 201,
                message: "Message sent",
                data: result
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }

    async joinRoom(req: Request, res: Response) {
        try {
            const { chatroomId } = req.params;
            const session = (req as any).session;
            const identityId = session?.identityId;
            const result = await this.joinRoomUseCase.execute({ ...req.body, chatroomId, identityId });
            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Successfully joined chatroom",
                data: {
                    chatroomId: result.conversationId,
                    roomname: result.roomName
                }
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }

    async checkAccess(req: Request, res: Response) {
        try {
            const { chatroomId } = req.params;
            const session = (req as any).session;
            const identityId = session?.identityId;
            const userAid = session?.identityAid;

            const room = await this.getChatroomDetailsUseCase.execute({ chatroomId: chatroomId as string });
            const isCreator = room.hostAid === userAid;
            const isParticipant = room.participants.some(p => p.userAid === userAid);

            if (isCreator || isParticipant || !room.isPrivate) {
                return res.status(200).json({
                    success: true,
                    status: "good",
                    statusCode: 200,
                    message: "Access granted",
                    data: { accessGranted: true, roomId: chatroomId }
                });
            }

            res.status(403).json({
                success: false,
                status: "bad",
                statusCode: 403,
                message: "This is a private room. You need a valid invite link to join.",
                data: { accessGranted: false }
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }

    async getMessages(req: Request, res: Response) {
        try {
            const { chatroomId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const before = typeof req.query.before === "string" ? req.query.before : undefined;
            const result = await this.getMessageHistoryUseCase.execute({
                conversationId: chatroomId as string,
                limit,
                before
            });
            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Messages retrieved",
                data: result
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }

    async getChatroomDetails(req: Request, res: Response) {
        try {
            const { chatroomId } = req.params;
            const details = await this.getChatroomDetailsUseCase.execute({ chatroomId: chatroomId as string });
            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Room details retrieved",
                data: details
            });
        } catch (error: any) {
            res.status(404).json({
                success: false,
                status: "bad",
                statusCode: 404,
                message: error.message
            });
        }
    }

    async getRoomDetailsSSE(req: Request, res: Response) {
        try {
            const { chatroomId } = req.params;
            if (typeof chatroomId !== "string") throw new Error("Invalid chatroomId");

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            // Send initial state
            const details = await this.getChatroomDetailsUseCase.execute({ chatroomId });
            res.write(`data: ${JSON.stringify(details)}\n\n`);

            // Register for updates
            this.sseService.addRoomClient(chatroomId, res);
        } catch (error: any) {
            res.status(404).json({ error: error.message });
        }
    }

    async getPublicRooms(req: Request, res: Response) {
        try {
            const isSSE = req.headers.accept === 'text/event-stream' || req.query.sse === 'true';
            const region = typeof req.query.region === "string" ? req.query.region : undefined;

            if (isSSE) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders();

                const sendUpdate = async () => {
                    const rooms = await this.getPublicRoomsUseCase.execute({ region });
                    // Map to client format
                    const mapped = rooms.map(r => ({
                        id: r.id,
                        roomname: r.roomName,
                        description: r.description || "",
                        hostAid: r.hostAid,
                        participantCount: 0, // Placeholder
                        lastMessage: null,
                        isLocked: r.isLocked,
                        isPrivate: r.isPrivate
                    }));
                    res.write(`data: ${JSON.stringify(mapped)}\n\n`);
                };

                await sendUpdate();
                this.sseService.addPublicListClient(res, region);

                // Optional: periodic update if needed, but SSEService handles list_update event
                return;
            }

            const rooms = await this.getPublicRoomsUseCase.execute({ region });
            const mapped = rooms.map(r => ({
                id: r.id,
                roomname: r.roomName,
                description: r.description || "",
                hostAid: r.hostAid,
                participantCount: 0,
                lastMessage: null,
                isLocked: r.isLocked,
                isPrivate: r.isPrivate
            }));

            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Public rooms retrieved",
                data: mapped
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }
}
