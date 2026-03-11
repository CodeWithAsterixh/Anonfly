import { db } from "../database/PostgresClient";
import { IVoucherRepository } from "../../business/logic/interfaces/IVoucherRepository";
import { Voucher } from "../../business/entities/Voucher";

export class PostgresVoucherRepository implements IVoucherRepository {
    async findByCode(code: string): Promise<Voucher | null> {
        const res = await db.query("SELECT * FROM vouchers WHERE code = $1", [code]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async save(voucher: Voucher): Promise<Voucher> {
        const res = await db.query(
            `INSERT INTO vouchers (code, features, transaction_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [voucher.code, voucher.features, voucher.transactionId]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async update(voucher: Voucher): Promise<Voucher> {
        const res = await db.query(
            `UPDATE vouchers 
             SET is_redeemed = $2, redeemed_by_identity_id = $3, redeemed_at = $4
             WHERE id = $1
             RETURNING *`,
            [voucher.id, voucher.isRedeemed, voucher.redeemedByIdentityId, voucher.redeemedAt]
        );
        return this.mapToEntity(res.rows[0]);
    }

    private mapToEntity(row: any): Voucher {
        return new Voucher(
            row.code,
            row.features,
            row.id,
            row.is_redeemed,
            row.redeemed_by_identity_id,
            row.transaction_id,
            row.created_at,
            row.redeemed_at
        );
    }
}
