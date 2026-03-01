export class Session {
    constructor(
        public readonly token: string,
        public readonly identityId: string,
        public readonly identityAid: string,
        public readonly expiresAt: Date,
        public readonly createdAt: Date = new Date()
    ) { }

    isValid(): boolean {
        return this.expiresAt > new Date();
    }
}
