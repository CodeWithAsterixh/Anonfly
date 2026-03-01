export class Identity {
    constructor(
        public readonly userAid: string,
        public readonly id?: string,
        public readonly username?: string,
        public readonly publicKey?: string,
        public readonly exchangePublicKey?: string,
        public readonly createdAt: Date = new Date(),
        public readonly updatedAt: Date = new Date()
    ) { }
}
