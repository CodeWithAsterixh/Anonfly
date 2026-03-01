export interface Participant {
    id?: string;
    conversationId: string;
    identityId: string;
    role: string;
    joinedAt: Date;
    encryptedSessionKey?: string;
}
