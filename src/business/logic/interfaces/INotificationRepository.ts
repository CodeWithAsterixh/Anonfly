import { Notification } from "../../entities/Notification";

export interface INotificationRepository {
    findAllForUser(identityId: string): Promise<Notification[]>;
    markAsRead(identityId: string, notificationId: string): Promise<void>;
    save(notification: Notification, recipientIds?: string[]): Promise<Notification>;
}
