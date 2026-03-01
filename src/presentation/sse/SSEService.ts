import { Response } from "express";
import { IEventEmitter, Events } from "../../events/IEventEmitter";
import { GetPublicRoomsUseCase } from "../../application/use-cases/GetPublicRooms";

export class SSEService {
    private roomClients: Map<string, Set<Response>> = new Map();
    private publicListClients: Map<Response, string | undefined> = new Map();

    constructor(
        private readonly eventEmitter: IEventEmitter,
        private readonly getPublicRoomsUseCase: GetPublicRoomsUseCase
    ) {
        this.setupSubscriptions();
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

    private broadcastToRoom(chatroomId: string, data: any) {
        const clients = this.roomClients.get(chatroomId);
        if (clients) {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            clients.forEach(client => client.write(message));
        }
    }

    private async broadcastToPublicList(data: any) {
        // If data is just a signal, we fetch the actual list
        if (data.type === 'list_update') {
            // Group clients by region to avoid redundant DB calls
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
                    participantCount: 0,
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
