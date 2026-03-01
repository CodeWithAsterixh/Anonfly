import { db } from "../database/PostgresClient";
import { IApiKeyRepository } from "../../business/logic/interfaces/IApiKeyRepository";
import { ApiKey } from "../../business/entities/ApiKey";

export class PostgresApiKeyRepository implements IApiKeyRepository {
    async findByHash(keyHash: string): Promise<ApiKey | null> {
        const res = await db.query("SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE", [keyHash]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async findAll(): Promise<ApiKey[]> {
        const res = await db.query("SELECT * FROM api_keys ORDER BY created_at DESC");
        return res.rows.map(row => this.mapToEntity(row));
    }

    async save(apiKey: ApiKey): Promise<ApiKey> {
        const res = await db.query(
            `INSERT INTO api_keys (key_hash, name, is_active)
       VALUES ($1, $2, $3)
       ON CONFLICT (key_hash) DO UPDATE 
       SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [apiKey.keyHash, apiKey.name, apiKey.isActive]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async delete(id: string): Promise<void> {
        await db.query("DELETE FROM api_keys WHERE id = $1", [id]);
    }

    private mapToEntity(row: any): ApiKey {
        return new ApiKey(
            row.id,
            row.key_hash,
            row.name,
            row.created_at,
            row.updated_at,
            row.is_active
        );
    }
}
