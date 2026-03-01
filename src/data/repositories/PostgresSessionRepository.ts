import { db } from "../database/PostgresClient";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";
import { Session } from "../../business/entities/Session";

export class PostgresSessionRepository implements ISessionRepository {
    async save(s: Session): Promise<Session> {
        const res = await db.query(
            `INSERT INTO sessions (token, identity_id, expires_at, created_at)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [s.token, s.identityId, s.expiresAt, s.createdAt]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async findByToken(token: string): Promise<Session | null> {
        const res = await db.query(
            `SELECT s.*, i.user_aid 
             FROM sessions s
             JOIN identities i ON s.identity_id = i.id
             WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
            [token]
        );
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async delete(token: string): Promise<void> {
        await db.query("DELETE FROM sessions WHERE token = $1", [token]);
    }

    async deleteExpired(): Promise<void> {
        await db.query("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP");
    }

    private mapToEntity(row: any): Session {
        return new Session(
            row.token,
            row.identity_id,
            row.user_aid || "", // identity_aid comes from join in findByToken
            row.expires_at,
            row.created_at
        );
    }
}
