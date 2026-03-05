import { Response } from "express";
import { GetPublicRoomsUseCase } from "../../application/use-cases/GetPublicRooms";
import { Events, IEventEmitter } from "../../events/IEventEmitter";

export class SSEService {
    private readonly roomClients: Map<string, Set<Response>> = new Map();
    private readonly publicListClients: Map<Response, string | undefined> = new Map();

    constructor(
        private readonly eventEmitter: IEventEmitter,
        private readonly getPublicRoomsUseCase: GetPublicRoomsUseCase
    ) {
        this.setupSubscriptions();
        this.startHeartbeat();
    }

    private startHeartbeat() {
        setInterval(() => {
            const heartbeat = `event: heartbeat\ndata: ${Date.now()}\n\n`;
            this.roomClients.forEach(clients => {
                clients.forEach(client => client.write(heartbeat));
            });
            this.publicListClients.forEach((_, client) => {
                client.write(heartbeat);
            });
        }, 30000); // Every 30 seconds
    }

    private setupSubscriptions() {
        // Listen for new messages to notify room details (last message, etc.)
        this.eventEmitter.on(Events.MESSAGE_CREATED, (payload) => {
            this.broadcastToRoom(payload.conversationId, { type: 'message', ...payload });
            // Also notify public list to update "last message" snippet
            this.broadcastToPublicList({ type: 'list_update' });
        });

        this.eventEmitter.on(Events.CONVERSATION_CREATED, () => {
            this.broadcastToPublicList({ type: 'list_update' });
        });

        this.eventEmitter.on(Events.PARTICIPANT_JOINED, () => {
            this.broadcastToPublicList({ type: 'list_update' });
        });

        this.eventEmitter.on(Events.PARTICIPANT_LEFT, () => {
            this.broadcastToPublicList({ type: 'list_update' });
        });
    }

    addRoomClient(chatroomId: string, res: Response) {
        if (!this.roomClients.has(chatroomId)) {
            this.roomClients.set(chatroomId, new Set());
        }
        this.roomClients.get(chatroomId)!.add(res);

        res.on('close', () => {
            this.roomClients.get(chatroomId)?.delete(res);
        });
    }

    addPublicListClient(res: Response, region?: string) {
        this.publicListClients.set(res, region);
        res.on('close', () => {
            this.publicListClients.delete(res);
        });
    }

    private broadcastToRoom(chatroomId: string, data: Record<string, unknown>) {
        const clients = this.roomClients.get(chatroomId);
        if (clients) {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            clients.forEach(client => client.write(message));
        }
    }

    private async broadcastToPublicList(data?: Record<string, unknown>) {
        // Always broadcast the full list if data is missing or is list_update
        if (!data || data.type === 'list_update') {
            const regionGroups: Map<string | undefined, Response[]> = new Map();
            this.publicListClients.forEach((region, client) => {
                const clients = regionGroups.get(region) || [];
                clients.push(client);
                regionGroups.set(region, clients);
            });

            for (const [region, clients] of regionGroups.entries()) {
                const rooms = await this.getPublicRoomsUseCase.execute({ region });
                const mapped = rooms.map(r => ({
                    id: r.id,
                    roomname: r.roomName,
                    description: r.description || "",
                    hostAid: r.hostAid,
                    participantCount: r.participantCount,
                    lastMessage: null,
                    isLocked: r.isLocked,
                    isPrivate: r.isPrivate
                }));
                const message = `data: ${JSON.stringify(mapped)}\n\n`;
                clients.forEach(client => client.write(message));
            }
        } else {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            this.publicListClients.forEach((_, client) => client.write(message));
        }
    }
}
