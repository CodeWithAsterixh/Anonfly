export class Reaction {
    constructor(
        public readonly userAid: string,
        public readonly username: string,
        public readonly emojiId: string,
        public readonly emojiValue: string,
        public readonly emojiType: string
    ) { }
}

export class Message {
    constructor(
        public readonly id: string,
        public readonly conversationId: string,
        public readonly senderId: string,
        public readonly content: string,
        public readonly timestamp: Date,
        public readonly sequenceId: number,
        public readonly signature?: string,
        public readonly isEdited: boolean = false,
        public readonly isDeleted: boolean = false,
        public readonly replyToId?: string,
        public readonly senderAid?: string,
        public readonly senderUsername?: string,
        public readonly reactions: Reaction[] = []
    ) { }
}
