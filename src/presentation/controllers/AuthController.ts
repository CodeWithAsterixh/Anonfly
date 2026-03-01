import { Request, Response } from "express";
import { GenerateChallengeUseCase } from "../../application/use-cases/GenerateChallenge";
import { VerifyIdentityUseCase } from "../../application/use-cases/VerifyIdentity";

export class AuthController {
    constructor(
        private readonly generateChallengeUseCase: GenerateChallengeUseCase,
        private readonly verifyIdentityUseCase: VerifyIdentityUseCase
    ) { }

    async getChallenge(req: Request, res: Response) {
        try {
            const { aid } = req.body;
            const result = await this.generateChallengeUseCase.execute({ aid });
            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Challenge generated",
                data: result
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                status: "bad",
                statusCode: 400,
                message: error.message
            });
        }
    }

    async verify(req: Request, res: Response) {
        try {
            const result = await this.verifyIdentityUseCase.execute(req.body);
            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Handshake successful",
                data: {
                    ...result,
                    allowedFeatures: ["create_room", "large_files", "no_ads"], // Placeholder
                    isPremium: true // Placeholder
                }
            });
        } catch (error: any) {
            res.status(401).json({
                success: false,
                status: "bad",
                statusCode: 401,
                message: error.message
            });
        }
    }

    async getPremiumStatus(req: Request, res: Response) {
        res.status(200).json({
            success: true,
            status: "good",
            statusCode: 200,
            message: "Premium status retrieved",
            data: {
                isPremium: true,
                allowedFeatures: ["create_room", "large_files", "no_ads"]
            }
        });
    }
}
