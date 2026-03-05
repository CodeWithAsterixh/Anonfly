import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";

export interface SaveRoomKeyInput {
    chatroomId: string;
    encryptedKey: string;
    iv: string;
}

export class SaveRoomKeyUseCase {
    constructor(private readonly conversationRepo: IConversationRepository) { }

    async execute(input: SaveRoomKeyInput) {
        const conversation = await this.conversationRepo.findById(input.chatroomId);
        if (!conversation) throw new Error("Conversation not found");

        // Use the new update method
        const updatedConversation = {
            ...conversation,
            encryptedRoomKey: input.encryptedKey,
            roomKeyIv: input.iv
        };

        return await this.conversationRepo.update(updatedConversation);
    }
}
