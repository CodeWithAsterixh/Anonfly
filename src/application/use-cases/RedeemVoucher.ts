import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";
import { IVoucherRepository } from "../../business/logic/interfaces/IVoucherRepository";
import { IEventEmitter, Events } from "../../events/IEventEmitter";

export class RedeemVoucherUseCase {
    constructor(
        private readonly voucherRepo: IVoucherRepository,
        private readonly identityRepo: IIdentityRepository,
        private readonly eventEmitter: IEventEmitter
    ) {}

    async execute(code: string, identityId: string) {
        const voucher = await this.voucherRepo.findByCode(code);
        if (!voucher) throw new Error("Voucher not found");
        if (voucher.isRedeemed) throw new Error("Voucher already redeemed");

        const identity = await this.identityRepo.findById(identityId);
        if (!identity) throw new Error("Identity not found");

        // Merge features
        const existingFeatures = identity.allowedFeatures || [];
        const newFeatures = Array.from(new Set([...existingFeatures, ...voucher.features]));

        // Update identity
        const updatedIdentity = {
            ...identity,
            allowedFeatures: newFeatures,
            updatedAt: new Date()
        };
        await this.identityRepo.update(updatedIdentity as any);

        // Mark voucher as redeemed
        const updatedVoucher = {
            ...voucher,
            isRedeemed: true,
            redeemedByIdentityId: identityId,
            redeemedAt: new Date()
        };
        await this.voucherRepo.update(updatedVoucher as any);

        // Emit update for WebSocket sync
        this.eventEmitter.emit(Events.IDENTITY_UPDATED, {
            identityId: identity.id,
            userAid: identity.userAid,
            allowedFeatures: newFeatures
        });

        return {
            success: true,
            features: voucher.features
        };
    }
}
