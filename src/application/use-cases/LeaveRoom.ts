import { IParticipantRepository } from "../../business/logic/interfaces/IParticipantRepository";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface LeaveRoomRequest {
    conversationId: string;
    identityId: string;
}

export class LeaveRoomUseCase {
    constructor(
        private readonly participantRepo: IParticipantRepository,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(request: LeaveRoomRequest) {
        await this.participantRepo.delete(request.conversationId, request.identityId);

        this.eventEmitter.emit(Events.PARTICIPANT_LEFT, {
            conversationId: request.conversationId,
            identityId: request.identityId
        });
    }
}
