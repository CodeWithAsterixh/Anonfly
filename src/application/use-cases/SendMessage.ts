import { MessageLogic } from "../../business/logic/MessageLogic";
import { IdentityLogic } from "../../business/logic/IdentityLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface SendMessageInput {
    conversationId: string;
    identityId: string;
    content: string;
    signature?: string;
    replyToId?: string;
}

export class SendMessageUseCase {
    constructor(
        private readonly messageLogic: MessageLogic,
        private readonly identityLogic: IdentityLogic,
        private readonly eventEmitter: IEventEmitter
    ) { }

    async execute(input: SendMessageInput) {
        // 1. Get verified sender identity
        const sender = await this.identityLogic.getIdentityById(input.identityId);
        const senderId = sender.id!;
        const senderAid = sender.userAid;
        const senderUsername = sender.username;

        // 2. Persist message
        const message = await this.messageLogic.sendMessage(
            input.conversationId,
            senderId,
            input.content,
            input.signature,
            input.replyToId
        );

        // 3. Emit event
        this.eventEmitter.emit(Events.MESSAGE_CREATED, {
            ...message,
            senderAid: senderAid,
            senderUsername: senderUsername
        });

        return message;
    }
}
