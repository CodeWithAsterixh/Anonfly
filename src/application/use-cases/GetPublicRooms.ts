import { Conversation } from "../../business/entities/Conversation";
import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";
import { IParticipantRepository } from "../../business/logic/interfaces/IParticipantRepository";

export interface EnrichedConversation extends Conversation {
    participantCount: number;
}

export interface GetPublicRoomsRequest {
    region?: string;
}

export class GetPublicRoomsUseCase {
    constructor(
        private readonly conversationRepo: IConversationRepository,
        private readonly participantRepo: IParticipantRepository
    ) { }

    async execute(request: GetPublicRoomsRequest): Promise<EnrichedConversation[]> {
        const rooms = await this.conversationRepo.listPublic(request.region);
        return await Promise.all(rooms.map(async (r) => {
            const count = await this.participantRepo.countByConversation(r.id!);
            return {
                ...r,
                participantCount: count
            } as EnrichedConversation;
        }));
    }
}
