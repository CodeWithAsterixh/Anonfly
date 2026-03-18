import { Request, Response } from "express";
import { INotificationRepository } from "../../business/logic/interfaces/INotificationRepository";

export class NotificationController {
    constructor(private readonly notificationRepo: INotificationRepository) { }

    /**
     * @description Fetches all notifications for the authenticated user
     */
    async getNotifications(req: Request, res: Response) {
        try {
            const session = (req as any).session;
            if (!session?.identityId) throw new Error("Authentication required");

            const notifications = await this.notificationRepo.findAllForUser(session.identityId);

            res.status(200).json({
                success: true,
                data: notifications.map(n => ({
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    type: n.type,
                    createdAt: n.createdAt,
                    isRead: n.isRead,
                    readAt: n.readAt,
                    expiresAt: n.expiresAt
                }))
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * @description Marks a specific notification as read for the user
     */
    async markAsRead(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const session = (req as any).session;
            if (!session?.identityId) throw new Error("Authentication required");

            await this.notificationRepo.markAsRead(session.identityId, id as string);

            res.status(200).json({
                success: true,
                message: "Notification marked as read"
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
