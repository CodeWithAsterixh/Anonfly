import { Request, Response } from "express";
import { IApiKeyRepository } from "../../business/logic/interfaces/IApiKeyRepository";
import { ApiKey } from "../../business/entities/ApiKey";
import crypto from "node:crypto";
import { ITransactionRepository } from "../../business/logic/interfaces/ITransactionRepository";
import { IVoucherRepository } from "../../business/logic/interfaces/IVoucherRepository";
import { RedeemVoucherUseCase } from "../../application/use-cases/RedeemVoucher";
import { Voucher } from "../../business/entities/Voucher";
import { v4 as uuidv4 } from "uuid";

export class AdminController {
    constructor(
        private readonly apiKeyRepository: IApiKeyRepository,
        private readonly transactionRepo: ITransactionRepository,
        private readonly voucherRepo: IVoucherRepository,
        private readonly redeemVoucherUseCase: RedeemVoucherUseCase
    ) { }

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

    async listPendingTransactions(req: Request, res: Response): Promise<void> {
        try {
            const transactions = await this.transactionRepo.findByStatus('awaiting_review');
            res.json(transactions);
        } catch (error) {
            console.error("Error listing pending transactions:", error);
            res.status(500).json({ error: "Failed to list pending transactions" });
        }
    }

    async approveTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id as any;
            const transaction = await this.transactionRepo.findById(id);

            if (!transaction) {
                res.status(404).json({ error: "Transaction not found" });
                return;
            }

            if (transaction.status !== 'awaiting_review') {
                res.status(400).json({ error: "Transaction is not awaiting review" });
                return;
            }

            // 1. Update transaction status
            const updatedTransaction = { ...transaction, status: 'completed' as const };
            await this.transactionRepo.update(updatedTransaction as any);

            // 2. Generate a voucher
            const voucherCode = `PREM-MAN-${uuidv4().substring(0, 8).toUpperCase()}`;
            await this.voucherRepo.save(new Voucher(
                voucherCode,
                ["create_private_hidden_room", "large_files", "no_ads"],
                undefined,
                false,
                undefined,
                transaction.id
            ));

            // 3. Redeem the voucher for the user
            if (transaction.identityId) {
                await this.redeemVoucherUseCase.execute(voucherCode, transaction.identityId);
            }

            res.json({ success: true, message: "Transaction approved and premium activated", voucherCode });
        } catch (error) {
            console.error("Error approving transaction:", error);
            res.status(500).json({ error: "Failed to approve transaction" });
        }
    }

    async rejectTransaction(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id as any;
            const transaction = await this.transactionRepo.findById(id);

            if (!transaction) {
                res.status(404).json({ error: "Transaction not found" });
                return;
            }

            const updatedTransaction = { ...transaction, status: 'failed' as const };
            await this.transactionRepo.update(updatedTransaction as any);

            res.json({ success: true, message: "Transaction rejected" });
        } catch (error) {
            console.error("Error rejecting transaction:", error);
            res.status(500).json({ error: "Failed to reject transaction" });
        }
    }
}
