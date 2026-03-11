export class Voucher {
    constructor(
        public readonly code: string,
        public readonly features: string[],
        public readonly id?: string,
        public readonly isRedeemed: boolean = false,
        public readonly redeemedByIdentityId?: string,
        public readonly transactionId?: string,
        public readonly createdAt: Date = new Date(),
        public readonly redeemedAt?: Date
    ) {}
}
