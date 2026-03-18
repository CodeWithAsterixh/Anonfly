export type NotificationType = 'GLOBAL' | 'PRIVATE';

export class Notification {
    constructor(
        public readonly id: string | undefined,
        public readonly title: string,
        public readonly content: string,
        public readonly type: NotificationType,
        public readonly createdAt: Date = new Date(),
        public readonly isRead: boolean = false,
        public readonly readAt: Date | undefined = undefined,
        public readonly expiresAt: Date | undefined = undefined
    ) {}

    static create(title: string, content: string, type: NotificationType, expiresAt?: Date): Notification {
        return new Notification(undefined, title, content, type, new Date(), false, undefined, expiresAt);
    }
}
