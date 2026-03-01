export class ApiKey {
    constructor(
        public readonly id: string | undefined,
        public readonly keyHash: string,
        public readonly name: string | undefined,
        public readonly createdAt: Date = new Date(),
        public readonly updatedAt: Date = new Date(),
        public readonly isActive: boolean = true
    ) { }
}
