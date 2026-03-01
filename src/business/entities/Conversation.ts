export class Conversation {
    constructor(
        public readonly id: string,
        public readonly roomName: string,
        public readonly hostAid: string,
        public readonly creatorAid: string,
        public readonly description?: string,
        public readonly region?: string,
        public readonly encryptedRoomKey?: string,
        public readonly roomKeyIv?: string,
        public readonly isLocked: boolean = false,
        public readonly passwordHash?: string,
        public readonly isPrivate: boolean = false,
        public readonly createdAt: Date = new Date(),
        public readonly updatedAt: Date = new Date()
    ) { }
}
