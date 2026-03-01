import { Request, Response } from "express";
import { IApiKeyRepository } from "../../business/logic/interfaces/IApiKeyRepository";
import { ApiKey } from "../../business/entities/ApiKey";
import crypto from "crypto";

export class AdminController {
    constructor(private apiKeyRepository: IApiKeyRepository) { }

    async listApiKeys(req: Request, res: Response): Promise<void> {
        try {
            const keys = await this.apiKeyRepository.findAll();
            res.json(keys);
        } catch (error) {
            console.error("Error listing API keys:", error);
            res.status(500).json({ error: "Failed to list API keys" });
        }
    }

    async createApiKey(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: "Name is required" });
                return;
            }

            // Generate a secure random API key
            const rawKey = `af_${crypto.randomBytes(24).toString('hex')}`;
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            const apiKey = new ApiKey(undefined, keyHash, name);
            const savedKey = await this.apiKeyRepository.save(apiKey);

            // Return the raw key ONLY during creation
            res.status(201).json({
                ...savedKey,
                rawKey: rawKey
            });
        } catch (error) {
            console.error("Error creating API key:", error);
            res.status(500).json({ error: "Failed to create API key" });
        }
    }

    async toggleApiKey(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { isActive } = req.body;

            const resKeys = await this.apiKeyRepository.findAll();
            const key = resKeys.find(k => k.id === id);

            if (!key) {
                res.status(404).json({ error: "API key not found" });
                return;
            }

            const updatedKey = new ApiKey(
                key.id,
                key.keyHash,
                key.name,
                key.createdAt,
                new Date(),
                isActive
            );

            await this.apiKeyRepository.save(updatedKey);
            res.json(updatedKey);
        } catch (error) {
            console.error("Error toggling API key:", error);
            res.status(500).json({ error: "Failed to toggle API key" });
        }
    }

    async deleteApiKey(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            await this.apiKeyRepository.delete(id as string);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting API key:", error);
            res.status(500).json({ error: "Failed to delete API key" });
        }
    }
}
