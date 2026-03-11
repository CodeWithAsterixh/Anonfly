import { db } from "../database/PostgresClient";
import { ITransactionRepository } from "../../business/logic/interfaces/ITransactionRepository";
import { Transaction } from "../../business/entities/Transaction";

export class PostgresTransactionRepository implements ITransactionRepository {
    async findById(id: string): Promise<Transaction | null> {
        const res = await db.query("SELECT * FROM transactions WHERE id = $1", [id]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async findByProviderTransactionId(providerId: string): Promise<Transaction | null> {
        const res = await db.query("SELECT * FROM transactions WHERE provider_transaction_id = $1", [providerId]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async save(transaction: Transaction): Promise<Transaction> {
        const res = await db.query(
            `INSERT INTO transactions (identity_id, provider_transaction_id, provider, amount, currency, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                transaction.identityId,
                transaction.providerTransactionId,
                transaction.provider,
                transaction.amount,
                transaction.currency,
                transaction.status,
                JSON.stringify(transaction.metadata)
            ]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async update(transaction: Transaction): Promise<Transaction> {
        const res = await db.query(
            `UPDATE transactions 
             SET status = $2, metadata = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [transaction.id, transaction.status, JSON.stringify(transaction.metadata)]
        );
        return this.mapToEntity(res.rows[0]);
    }

    private mapToEntity(row: any): Transaction {
        return new Transaction(
            row.provider,
            Number(row.amount),
            row.provider_transaction_id,
            row.status,
            row.id,
            row.identity_id,
            row.currency,
            row.metadata,
            row.created_at,
            row.updated_at
        );
    }
}
