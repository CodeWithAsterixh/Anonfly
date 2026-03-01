import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";

export interface GetPublicRoomsRequest {
    region?: string;
}

export class GetPublicRoomsUseCase {
    constructor(private readonly conversationRepo: IConversationRepository) { }

    async execute(request: GetPublicRoomsRequest) {
        return await this.conversationRepo.listPublic(request.region);
    }
}
