import { MessageLogic } from "../../business/logic/MessageLogic";
import { IdentityLogic } from "../../business/logic/IdentityLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface AddReactionInput {
    messageId: string;
    userAid: string;
    emojiId: string;
    emojiValue: string;
    emojiType: string;
}

export class AddReactionUseCase {
    constructor(
        private readonly messageLogic: MessageLogic,
        private readonly identityLogic: IdentityLogic,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(input: AddReactionInput) {
        const identity = await this.identityLogic.getOrCreateIdentity(input.userAid);

        const msgBefore = await this.messageLogic.messageRepo.findById(input.messageId);
        if (!msgBefore) return;

        await this.messageLogic.addReaction(
            input.messageId,
            identity.id!,
            input.emojiId,
            input.emojiValue,
            input.emojiType
        );

        const msgAfter = await this.messageLogic.messageRepo.findById(input.messageId);
        if (msgAfter) {
            this.eventEmitter.emit(Events.REACTION_ADDED, {
                messageId: input.messageId,
                conversationId: msgAfter.conversationId,
                reactions: msgAfter.reactions
            });
        }
    }
}
