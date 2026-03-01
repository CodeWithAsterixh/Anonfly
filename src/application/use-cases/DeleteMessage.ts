import { MessageLogic } from "../../business/logic/MessageLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface DeleteMessageInput {
    messageId: string;
}

export class DeleteMessageUseCase {
    constructor(
        private readonly messageLogic: MessageLogic,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(input: DeleteMessageInput) {
        await this.messageLogic.deleteMessage(input.messageId);

        this.eventEmitter.emit(Events.MESSAGE_DELETED, {
            messageId: input.messageId
        });
    }
}
