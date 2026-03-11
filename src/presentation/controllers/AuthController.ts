import { Request, Response } from "express";
import { GenerateChallengeUseCase } from "../../application/use-cases/GenerateChallenge";
import { VerifyIdentityUseCase } from "../../application/use-cases/VerifyIdentity";

import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";

export class AuthController {
    constructor(
        private readonly generateChallengeUseCase: GenerateChallengeUseCase,
        private readonly verifyIdentityUseCase: VerifyIdentityUseCase,
        private readonly identityRepository: IIdentityRepository
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
                    isPremium: result.allowedFeatures?.includes("no_ads") // Example logic
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
        try {
            const session = (req as any).session;
            const identity = await this.identityRepository.findByAid(session.identityAid);
            if (!identity) throw new Error("Identity not found");

            res.status(200).json({
                success: true,
                status: "good",
                statusCode: 200,
                message: "Premium status retrieved",
                data: {
                    isPremium: identity.allowedFeatures?.includes("no_ads"),
                    allowedFeatures: identity.allowedFeatures
                }
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
}
