export class Transaction {
    constructor(
        public readonly provider: string,
        public readonly amount: number,
        public readonly providerTransactionId: string,
        public readonly status: 'pending' | 'completed' | 'failed',
        public readonly id?: string,
        public readonly identityId?: string,
        public readonly currency: string = 'USD',
        public readonly metadata: any = {},
        public readonly createdAt: Date = new Date(),
        public readonly updatedAt: Date = new Date()
    ) {}
}
