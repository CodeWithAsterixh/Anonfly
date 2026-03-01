import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";
import { IParticipantRepository } from "../../business/logic/interfaces/IParticipantRepository";
import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";

export interface GetChatroomDetailsInput {
    chatroomId: string;
}

export class GetChatroomDetailsUseCase {
    constructor(
        private readonly conversationRepo: IConversationRepository,
        private readonly participantRepo: IParticipantRepository,
        private readonly identityRepo: IIdentityRepository
    ) { }

    async execute(input: GetChatroomDetailsInput) {
        const conversation = await this.conversationRepo.findById(input.chatroomId);
        if (!conversation) throw new Error("Conversation not found");

        const participantsWithIdentities = await this.participantRepo.listByConversation(conversation.id!);

        // Enrich participants with usernames and public keys
        const enrichedParticipants = await Promise.all(
            participantsWithIdentities.map(async (p) => {
                const identity = await this.identityRepo.findById(p.identityId);
                return {
                    userAid: identity?.userAid || "unknown",
                    username: identity?.username || "Anonymous",
                    publicKey: identity?.publicKey,
                    exchangePublicKey: identity?.exchangePublicKey,
                    role: p.role,
                    joinedAt: p.joinedAt
                };
            })
        );

        return {
            roomId: conversation.id,
            roomname: conversation.roomName,
            description: conversation.description || "",
            hostAid: conversation.hostAid,
            creatorAid: conversation.creatorAid,
            isLocked: conversation.isLocked,
            isPrivate: conversation.isPrivate,
            encryptedRoomKey: conversation.encryptedRoomKey,
            roomKeyIv: conversation.roomKeyIv,
            participants: enrichedParticipants,
            participantCount: enrichedParticipants.length
        };
    }
}
