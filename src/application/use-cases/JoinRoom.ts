import { Identity } from "../../business/entities/Identity";
import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";
import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";
import { IParticipantRepository } from "../../business/logic/interfaces/IParticipantRepository";

import { Events, IEventEmitter } from "../../events/IEventEmitter";

export interface JoinRoomRequest {
    roomName?: string;
    conversationId?: string;
    identityId: string;
    encryptedSessionKey?: string;
}

export class JoinRoomUseCase {
    constructor(
        private readonly conversationRepo: IConversationRepository,
        private readonly identityRepo: IIdentityRepository,
        private readonly participantRepo: IParticipantRepository,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(request: JoinRoomRequest) {
        let conversation;
        if (request.conversationId) {
            conversation = await this.conversationRepo.findById(request.conversationId);
        } else if (request.roomName) {
            conversation = await this.conversationRepo.findByName(request.roomName);
        }

        if (!conversation) throw new Error("Conversation not found");

        const identityId = request.identityId;
        const identity = await this.identityRepo.findById(identityId);
        if (!identity) throw new Error("Identity not found");

        const existingParticipant = await this.participantRepo.findByConversationAndIdentity(
            conversation.id,
            identityId
        );

        if (!existingParticipant) {
            await this.participantRepo.save({
                conversationId: conversation.id,
                identityId: identityId,
                role: "member",
                joinedAt: new Date(),
                encryptedSessionKey: request.encryptedSessionKey
            });

            this.eventEmitter.emit(Events.PARTICIPANT_JOINED, {
                conversationId: conversation.id,
                identityId: identityId
            });
        }

        return {
            conversationId: conversation.id,
            identityId: identityId,
            roomName: conversation.roomName
        };
    }
}
