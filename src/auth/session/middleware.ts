import { Request, Response, NextFunction } from "express";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";

export const sessionAuth = (sessionRepository: ISessionRepository) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or invalid session token" });
        }

        const token = authHeader.split(" ")[1];
        try {
            const session = await sessionRepository.findByToken(token);
            if (!session) {
                return res.status(401).json({ error: "Session expired or invalid" });
            }

            // Optional: attach session to request if needed
            (req as any).session = session;
            next();
        } catch (error) {
            res.status(500).json({ error: "Authentication error" });
        }
    };
};
