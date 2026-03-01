import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";
import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";
import { IParticipantRepository } from "../../business/logic/interfaces/IParticipantRepository";
import { Identity } from "../../business/entities/Identity";
import { Participant } from "../../business/entities/Participant";

export interface JoinRoomRequest {
    roomName?: string;
    conversationId?: string;
    userAid: string;
    identityId?: string;
    username?: string;
    publicKey?: string;
    encryptedSessionKey?: string;
}

export class JoinRoomUseCase {
    constructor(
        private readonly conversationRepo: IConversationRepository,
        private readonly identityRepo: IIdentityRepository,
        private readonly participantRepo: IParticipantRepository
    ) { }

    async execute(request: JoinRoomRequest) {
        let conversation;
        if (request.conversationId) {
            conversation = await this.conversationRepo.findById(request.conversationId);
        } else if (request.roomName) {
            conversation = await this.conversationRepo.findByName(request.roomName);
        }

        if (!conversation) throw new Error("Conversation not found");

        let identityId = request.identityId;

        if (!identityId) {
            let identity = await this.identityRepo.findByAid(request.userAid);
            if (!identity) {
                identity = await this.identityRepo.save(new Identity(
                    request.userAid,
                    undefined,
                    request.username || undefined,
                    request.publicKey || undefined
                ));
            }
            identityId = identity.id!;
        }

        const existingParticipant = await this.participantRepo.findByConversationAndIdentity(
            conversation.id!,
            identityId
        );

        if (!existingParticipant) {
            await this.participantRepo.save({
                conversationId: conversation.id!,
                identityId: identityId,
                role: "member",
                joinedAt: new Date(),
                encryptedSessionKey: request.encryptedSessionKey
            });
        }

        return {
            conversationId: conversation.id,
            identityId: identityId,
            roomName: conversation.roomName
        };
    }
}
