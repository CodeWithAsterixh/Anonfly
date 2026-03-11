import { Router } from "express";
import { PaymentController } from "../controllers/PaymentController";
import { sessionAuth } from "../../auth/session/middleware";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";

export function createPaymentRoutes(
    paymentController: PaymentController,
    sessionRepo: ISessionRepository
): Router {
    const router = Router();

    // Secure payments
    router.post("/create-intent", sessionAuth(sessionRepo), (req, res) => paymentController.createIntent(req, res));
    router.post("/redeem-voucher", sessionAuth(sessionRepo), (req, res) => paymentController.redeemVoucher(req, res));

    // Webhooks (Must be public, verification handled in controller)
    router.post("/webhook", (req, res) => paymentController.handleWebhook(req, res));

    return router;
}
