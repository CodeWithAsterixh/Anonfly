import { IMessageRepository } from "./interfaces/IMessageRepository";
import { Message } from "../entities/Message";
import { v4 as uuidv4 } from "uuid";

export class MessageLogic {
    constructor(private readonly messageRepo: IMessageRepository) { }

    async sendMessage(
        conversationId: string,
        senderId: string,
        content: string,
        signature?: string,
        replyToId?: string
    ): Promise<Message> {
        const sequenceId = (await this.messageRepo.getLatestSequenceId(conversationId)) + 1;

        const message = new Message(
            uuidv4(),
            conversationId,
            senderId,
            content,
            new Date(),
            sequenceId,
            signature,
            false,
            false,
            replyToId
        );

        return this.messageRepo.save(message);
    }

    async getMessages(conversationId: string, limit?: number, before?: Date): Promise<Message[]> {
        return this.messageRepo.findByConversationId(conversationId, limit, before);
    }

    async editMessage(messageId: string, content: string): Promise<void> {
        await this.messageRepo.update(messageId, content, true);
        const message = await this.messageRepo.findById(messageId);
        if (message) {
            // No event needed here if we broadcast from use case or controller?
            // Actually, we should emit if we want SSE/WS to pick it up.
        }
    }

    async deleteMessage(messageId: string): Promise<void> {
        await this.messageRepo.softDelete(messageId);
    }

    async addReaction(messageId: string, identityId: string, emojiId: string, emojiValue: string, emojiType: string): Promise<void> {
        await this.messageRepo.addReaction(messageId, identityId, emojiId, emojiValue, emojiType);
    }

    async removeReaction(messageId: string, identityId: string, emojiId: string): Promise<void> {
        await this.messageRepo.removeReaction(messageId, identityId, emojiId);
    }
}
