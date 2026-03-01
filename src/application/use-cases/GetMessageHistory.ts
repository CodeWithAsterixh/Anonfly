import { IMessageRepository } from "../../business/logic/interfaces/IMessageRepository";
import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";

export interface GetMessageHistoryRequest {
    conversationId: string;
    limit?: number;
    before?: string; // ISO Date
}

export class GetMessageHistoryUseCase {
    constructor(
        private readonly messageRepo: IMessageRepository,
        private readonly conversationRepo: IConversationRepository
    ) { }

    async execute(request: GetMessageHistoryRequest) {
        const conversation = await this.conversationRepo.findById(request.conversationId);
        if (!conversation) throw new Error("Conversation not found");

        const beforeDate = request.before ? new Date(request.before) : undefined;
        const messages = await this.messageRepo.findByConversationId(
            request.conversationId,
            request.limit || 50,
            beforeDate
        );

        return messages;
    }
}
