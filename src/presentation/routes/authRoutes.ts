import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { sessionAuth } from "../../auth/session/middleware";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";

export function createAuthRoutes(authController: AuthController, sessionRepo: ISessionRepository): Router {
    const router = Router();

    router.post("/challenge", (req, res) => authController.getChallenge(req, res));
    router.post("/verify", (req, res) => authController.verify(req, res));
    router.get("/premium-status", sessionAuth(sessionRepo), (req, res) => authController.getPremiumStatus(req, res));

    return router;
}
