import { db } from "../database/PostgresClient";
import { INotificationRepository } from "../../business/logic/interfaces/INotificationRepository";
import { Notification, NotificationType } from "../../business/entities/Notification";

export class PostgresNotificationRepository implements INotificationRepository {
    async findAllForUser(identityId: string): Promise<Notification[]> {
        const query = `
            SELECT 
                n.id, 
                n.title, 
                n.content, 
                n.type, 
                n.created_at, 
                n.expires_at,
                COALESCE(nr.is_read, FALSE) as is_read,
                nr.read_at
            FROM notifications n
            LEFT JOIN notification_recipients nr ON n.id = nr.notification_id AND nr.recipient_id = $1
            WHERE 
                (n.type = 'GLOBAL') 
                OR 
                (n.type = 'PRIVATE' AND n.id IN (
                    SELECT notification_id FROM notification_recipients WHERE recipient_id = $1
                ))
            ORDER BY n.created_at DESC
        `;

        const result = await db.query(query, [identityId]);

        return result.rows.map(row => new Notification(
            row.id,
            row.title,
            row.content,
            row.type as NotificationType,
            row.created_at,
            row.is_read,
            row.read_at,
            row.expires_at
        ));
    }

    async markAsRead(identityId: string, notificationId: string): Promise<void> {
        const query = `
            INSERT INTO notification_recipients (notification_id, recipient_id, is_read, read_at)
            VALUES ($2, $1, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (notification_id, recipient_id) 
            DO UPDATE SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE notification_recipients.is_read = FALSE
        `;

        await db.query(query, [identityId, notificationId]);
    }

    async save(notification: Notification, recipientIds?: string[]): Promise<Notification> {
        return await db.transaction(async (client) => {
            const insertNotificationQuery = `
                INSERT INTO notifications (title, content, type, expires_at)
                VALUES ($1, $2, $3, $4)
                RETURNING id, created_at
            `;

            const nResult = await client.query(insertNotificationQuery, [
                notification.title,
                notification.content,
                notification.type,
                notification.expiresAt
            ]);

            const notificationId = nResult.rows[0].id;
            const createdAt = nResult.rows[0].created_at;

            if (notification.type === 'PRIVATE' && recipientIds && recipientIds.length > 0) {
                const insertRecipientQuery = `
                    INSERT INTO notification_recipients (notification_id, recipient_id)
                    VALUES ($1, $2)
                `;
                for (const recipientId of recipientIds) {
                    await client.query(insertRecipientQuery, [notificationId, recipientId]);
                }
            }

            return new Notification(
                notificationId,
                notification.title,
                notification.content,
                notification.type,
                createdAt,
                false,
                undefined,
                notification.expiresAt
            );
        });
    }
}
