import { MessageLogic } from "../../business/logic/MessageLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface EditMessageInput {
    messageId: string;
    content: string;
}

export class EditMessageUseCase {
    constructor(
        private readonly messageLogic: MessageLogic,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(input: EditMessageInput) {
        const message = await this.messageLogic.messageRepo.findById(input.messageId);
        if (!message) return;

        await this.messageLogic.editMessage(input.messageId, input.content);

        // Emit with conversationId for targeted broadcast
        this.eventEmitter.emit(Events.MESSAGE_EDITED, {
            messageId: input.messageId,
            conversationId: message.conversationId,
            content: input.content
        });
    }
}
