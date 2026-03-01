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
        await this.messageLogic.editMessage(input.messageId, input.content);

        // Re-fetch message for broadcast (or logic could return it)
        // For now, let's just emit the id and new content
        this.eventEmitter.emit(Events.MESSAGE_EDITED, {
            messageId: input.messageId,
            content: input.content
        });
    }
}
