import { Message } from "../../entities/Message";

export interface IMessageRepository {
    findById(id: string): Promise<Message | null>;
    save(message: Message): Promise<Message>;
    findByConversationId(conversationId: string, limit?: number, before?: Date): Promise<Message[]>;
    getLatestSequenceId(conversationId: string): Promise<number>;
    softDelete(id: string): Promise<void>;
    update(id: string, content: string, isEdited: boolean): Promise<void>;
    addReaction(messageId: string, identityId: string, emojiId: string, emojiValue: string, emojiType: string): Promise<void>;
    removeReaction(messageId: string, identityId: string, emojiId: string): Promise<void>;
}
