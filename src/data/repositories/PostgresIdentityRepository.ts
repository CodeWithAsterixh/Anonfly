import { db } from "../database/PostgresClient";
import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";
import { Identity } from "../../business/entities/Identity";

export class PostgresIdentityRepository implements IIdentityRepository {
    async findById(id: string): Promise<Identity | null> {
        const res = await db.query("SELECT * FROM identities WHERE id = $1", [id]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async findByAid(userAid: string): Promise<Identity | null> {
        const res = await db.query("SELECT * FROM identities WHERE user_aid = $1", [userAid]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async save(identity: Identity): Promise<Identity> {
        const res = await db.query(
            `INSERT INTO identities (user_aid, username, public_key, exchange_public_key)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [identity.userAid, identity.username, identity.publicKey, identity.exchangePublicKey]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async update(identity: Identity): Promise<Identity> {
        const res = await db.query(
            `UPDATE identities 
       SET username = $2, public_key = $3, exchange_public_key = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
            [identity.id, identity.username, identity.publicKey, identity.exchangePublicKey]
        );
        return this.mapToEntity(res.rows[0]);
    }

    private mapToEntity(row: any): Identity {
        return new Identity(
            row.user_aid,
            row.id,
            row.username,
            row.public_key,
            row.exchange_public_key,
            row.created_at,
            row.updated_at
        );
    }
}
