import { MessageLogic } from "../../business/logic/MessageLogic";
import { IdentityLogic } from "../../business/logic/IdentityLogic";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export interface SendMessageInput {
    conversationId: string;
    senderAid: string;
    identityId?: string;
    username?: string;
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
        // 1. Ensure/Update sender identity
        let senderId: string;
        let senderAid = input.senderAid;
        let senderUsername = input.username;

        if (input.identityId) {
            senderId = input.identityId;
        } else {
            const sender = await this.identityLogic.getOrCreateIdentity(input.senderAid, input.username);
            senderId = sender.id!;
            senderAid = sender.userAid;
            senderUsername = sender.username;
        }

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
