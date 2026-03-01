import { Conversation } from "../../entities/Conversation";

export interface IConversationRepository {
    findById(id: string): Promise<Conversation | null>;
    findByName(name: string): Promise<Conversation | null>;
    save(conversation: Conversation): Promise<Conversation>;
    delete(id: string): Promise<void>;
    listPublic(region?: string): Promise<Conversation[]>;
}
