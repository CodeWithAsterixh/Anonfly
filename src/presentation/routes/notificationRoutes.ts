import { Router } from "express";
import { NotificationController } from "../controllers/NotificationController";
import { sessionAuth } from "../../auth/session/middleware";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";

export const createNotificationRoutes = (
    notificationController: NotificationController,
    sessionRepo: ISessionRepository
): Router => {
    const router = Router();

    // All notification routes require session authentication
    router.use(sessionAuth(sessionRepo));

    router.get("/", (req, res) => notificationController.getNotifications(req, res));
    router.patch("/:id/read", (req, res) => notificationController.markAsRead(req, res));

    return router;
};
