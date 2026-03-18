import { MessageLogic } from "../../business/logic/MessageLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface DeleteMessageInput {
    messageId: string;
    identityId: string;
    mode: 'everyone' | 'me';
}

export class DeleteMessageUseCase {
    constructor(
        private readonly messageLogic: MessageLogic,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(input: DeleteMessageInput) {
        const message = await this.messageLogic.messageRepo.findById(input.messageId);
        if (!message) return;

        if (input.mode === 'everyone') {
            if (message.senderId !== input.identityId) {
                throw new Error("You can only delete your own messages for everyone.");
            }
            await this.messageLogic.deleteMessage(input.messageId);

            this.eventEmitter.emit(Events.MESSAGE_DELETED, {
                messageId: input.messageId,
                conversationId: message.conversationId
            });
        } else {
            await this.messageLogic.hideMessage(input.messageId, input.identityId);
        }
    }
}
