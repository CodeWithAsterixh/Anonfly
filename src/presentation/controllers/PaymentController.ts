import { Request, Response } from "express";
import { RedeemVoucherUseCase } from "../../application/use-cases/RedeemVoucher";
import Stripe from "stripe";
import { ITransactionRepository } from "../../business/logic/interfaces/ITransactionRepository";
import { IVoucherRepository } from "../../business/logic/interfaces/IVoucherRepository";
import { Transaction } from "../../business/entities/Transaction";
import { Voucher } from "../../business/entities/Voucher";
import { v4 as uuidv4 } from "uuid";

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
     * @description Creates a Stripe Checkout Session
     */
    async createIntent(req: Request, res: Response) {
        try {
            const { provider, amount } = req.body;
            const session = (req as any).session;

            if (provider === 'stripe') {
                const checkoutSession = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [
                        {
                            price_data: {
                                currency: 'usd',
                                product_data: {
                                    name: 'Anonfly Premium Upgrade',
                                    description: 'Unlock advanced privacy features and unlimited rooms.',
                                },
                                unit_amount: Math.round(amount * 100),
                            },
                            quantity: 1,
                        },
                    ],
                    mode: 'payment',
                    success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/settings?payment=success`,
                    cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/settings?payment=cancelled`,
                    metadata: {
                        identityId: session.identityId,
                    },
                });

                // Create a pending transaction
                await this.transactionRepo.save(new Transaction(
                    'stripe',
                    amount,
                    checkoutSession.id,
                    'pending',
                    undefined,
                    session.identityId
                ));

                return res.status(200).json({
                    success: true,
                    data: {
                        provider: 'stripe',
                        checkoutUrl: checkoutSession.url,
                    },
                });
            }

            // Fallback for other providers (Placeholders)
            res.status(200).json({
                success: true,
                data: {
                    provider,
                    amount,
                    address: provider === 'monero' ? '4...dummy_address' : null,
                    invoice: provider === 'lightning' ? 'lnbc...dummy_invoice' : null,
                }
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * @description Webhook handler for Stripe
     */
    async handleWebhook(req: Request, res: Response) {
        const sig = req.headers['stripe-signature'];
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                (req as any).rawBody || req.body,
                sig as string,
                process.env.STRIPE_WEBHOOK_SECRET || ""
            );
        } catch (err: any) {
            console.error(`Webhook Error: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const transaction = await this.transactionRepo.findByProviderTransactionId(session.id);

            if (transaction && transaction.status === 'pending') {
                // 1. Update transaction status
                const updatedTransaction = { ...transaction, status: 'completed' as const };
                await this.transactionRepo.update(updatedTransaction as any);

                // 2. Generate a voucher for the user
                const voucherCode = `PREM-${uuidv4().substring(0, 8).toUpperCase()}`;
                await this.voucherRepo.save(new Voucher(
                    voucherCode,
                    ["create_private_hidden_room", "large_files", "no_ads"],
                    undefined,
                    false,
                    undefined,
                    transaction.id
                ));

                console.log(`[Stripe Webhook] Voucher generated for transaction ${transaction.id}: ${voucherCode}`);
                
                // Note: In a real production system, you'd probably email this voucher or 
                // show it in a "My Purchases" section. For now, the user can redeem it.
            }
        }

        res.status(200).json({ received: true });
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
