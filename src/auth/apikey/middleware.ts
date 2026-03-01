import { Request, Response, NextFunction } from "express";
import { IApiKeyRepository } from "../../business/logic/interfaces/IApiKeyRepository";
import * as crypto from "crypto";

export const apiKeyAuth = (apiKeyRepo: IApiKeyRepository) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("ApiKey ")) {
            return res.status(401).json({ error: "Unauthorized: Missing or invalid API Key" });
        }

        const apiKey = authHeader.split(" ")[1];
        if (!apiKey) {
            return res.status(401).json({ error: "Unauthorized: API Key is required" });
        }

        // Hash the incoming key to compare with stored hashes
        const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

        const storedKey = await apiKeyRepo.findByHash(keyHash);

        if (!storedKey || !storedKey.isActive) {
            return res.status(401).json({ error: "Unauthorized: Invalid or inactive API Key" });
        }

        // Add app info to request for audit/logging if needed
        (req as any).appId = storedKey.id;
        (req as any).appName = storedKey.name;

        next();
    };
};
