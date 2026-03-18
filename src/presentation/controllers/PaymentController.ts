import { Request, Response } from "express";
import { RedeemVoucherUseCase } from "../../application/use-cases/RedeemVoucher";
import Stripe from "stripe";
import { ITransactionRepository } from "../../business/logic/interfaces/ITransactionRepository";
import { IVoucherRepository } from "../../business/logic/interfaces/IVoucherRepository";
import { Transaction } from "../../business/entities/Transaction";
import { v4 as uuidv4 } from "uuid";
import { sendMail } from "../../infrastructure/email/sendMail";
import { formatManualPaymentNotification } from "../../infrastructure/email/formatMail/manualPayment";

const stripe = new Stripe(process.env.STRIPE_API_KEY || "", {
    apiVersion: "2025-02-24.acacia" as any,
});

export class PaymentController {
    constructor(
        private readonly redeemVoucherUseCase: RedeemVoucherUseCase,
        private readonly transactionRepo: ITransactionRepository,
        private readonly voucherRepo: IVoucherRepository
    ) {}

    /**
     * @description Deprecated: Automatic payment intents are no longer supported.
     */
    async createIntent(req: Request, res: Response) {
        res.status(400).json({ 
            success: false, 
            message: "Automatic payment intents are currently disabled. Please use the Manual Transaction option in the UI." 
        });
    }

    /**
     * @description Webhook handler (Disabled)
     */
    async handleWebhook(req: Request, res: Response) {
        res.status(405).json({ success: false, message: "Webhook processing is disabled." });
    }

    /**
     * @description Submits a manual transaction proof for review
     */
    async submitManualProof(req: Request, res: Response) {
        try {
            const { amount, currency, proof } = req.body;
            const session = (req as any).session;

            if (!proof) throw new Error("Transaction proof is required");
            if (!session?.identityId) throw new Error("Authentication required");

            const transaction = new Transaction(
                'manual',
                amount || 0,
                `MAN-${uuidv4().substring(0, 8).toUpperCase()}`,
                'awaiting_review',
                undefined,
                session.identityId,
                proof,
                currency || 'USD'
            );

            const savedTransaction = await this.transactionRepo.save(transaction);

            // Send notification email to admin
            const adminEmail = process.env.SMTP_USER;
            if (adminEmail) {
                const mailHtml = formatManualPaymentNotification({
                    userAid: session.identityAid || "Unknown",
                    amount: amount || 5, // Default to $5
                    token: currency || "USDT",
                    proof: proof,
                    transactionId: savedTransaction.id || "Unknown"
                });

                await sendMail({
                    subject: `New Manual Payment Proof: ${currency || "USDT"} - from ${session.identityAid || "Unknown"}`,
                    html: mailHtml,
                    mailTo: adminEmail
                }).catch(err => {
                    console.error("Failed to send admin notification email:", err);
                });
            }

            res.status(200).json({
                success: true,
                message: "Proof submitted successfully. It will be reviewed within 2 business days.",
                data: { 
                    transactionId: savedTransaction.id,
                    providerTransactionId: savedTransaction.providerTransactionId 
                }
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * @description Redeems a pre-paid voucher
     */
    async redeemVoucher(req: Request, res: Response) {
        try {
            const { code } = req.body;
            const session = (req as any).session;
            
            if (!code) throw new Error("Voucher code is required");
            if (!session?.identityId) throw new Error("Authentication required");

            const result = await this.redeemVoucherUseCase.execute(code, session.identityId);

            res.status(200).json({
                success: true,
                message: "Voucher redeemed successfully",
                data: result
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}
