import { Router, Request, Response, NextFunction } from "express";
import { AdminController } from "../controllers/AdminController";

const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    const adminToken = process.env.ADMIN_TOKEN || "local-admin-secret";
    const providedToken = req.headers["x-admin-token"];

    if (providedToken !== adminToken) {
        res.status(401).json({ error: "Unauthorized admin access" });
        return;
    }
    next();
};

export const createAdminRoutes = (adminController: AdminController): Router => {
    const router = Router();

    router.use(adminAuth);

    router.get("/keys", (req, res) => adminController.listApiKeys(req, res));
    router.post("/keys", (req, res) => adminController.createApiKey(req, res));
    router.patch("/keys/:id", (req, res) => adminController.toggleApiKey(req, res));
    router.delete("/keys/:id", (req, res) => adminController.deleteApiKey(req, res));

    return router;
};
