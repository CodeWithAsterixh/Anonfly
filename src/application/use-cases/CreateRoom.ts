import { ConversationLogic } from "../../business/logic/ConversationLogic";
import { IdentityLogic } from "../../business/logic/IdentityLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface CreateRoomInput {
    roomName: string;
    hostAid: string;
    username?: string;
    description?: string;
    region?: string;
    isLocked?: boolean;
    passwordHash?: string;
    isPrivate?: boolean;
}

export class CreateRoomUseCase {
    constructor(
        private readonly conversationLogic: ConversationLogic,
        private readonly identityLogic: IdentityLogic,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(input: CreateRoomInput) {
        // 1. Ensure/Update host identity
        const host = await this.identityLogic.getOrCreateIdentity(input.hostAid, input.username);

        // 2. Create the room
        const conversation = await this.conversationLogic.createConversation(
            input.roomName,
            input.hostAid,
            input.hostAid, // Creator is the host in this flow
            {
                description: input.description,
                region: input.region,
                isLocked: input.isLocked,
                passwordHash: input.passwordHash,
                isPrivate: input.isPrivate,
            }
        );

        // 3. Emit event
        this.eventEmitter.emit(Events.CONVERSATION_CREATED, conversation);

        return conversation;
    }
}
