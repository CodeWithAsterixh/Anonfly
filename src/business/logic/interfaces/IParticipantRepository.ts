import { Participant } from "../../entities/Participant";

export interface IParticipantRepository {
    save(participant: Participant): Promise<Participant>;
    findByConversationAndIdentity(conversationId: string, identityId: string): Promise<Participant | null>;
    listByConversation(conversationId: string): Promise<Participant[]>;
    delete(conversationId: string, identityId: string): Promise<void>;
}
