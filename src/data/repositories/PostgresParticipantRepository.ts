import { db } from "../database/PostgresClient";
import { IParticipantRepository } from "../../business/logic/interfaces/IParticipantRepository";
import { Participant } from "../../business/entities/Participant";

export class PostgresParticipantRepository implements IParticipantRepository {
    async save(p: Participant): Promise<Participant> {
        const res = await db.query(
            `INSERT INTO participants (conversation_id, identity_id, role, encrypted_session_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (conversation_id, identity_id) DO UPDATE 
       SET role = EXCLUDED.role, encrypted_session_key = EXCLUDED.encrypted_session_key
       RETURNING *`,
            [p.conversationId, p.identityId, p.role, p.encryptedSessionKey]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async findByConversationAndIdentity(conversationId: string, identityId: string): Promise<Participant | null> {
        const res = await db.query(
            "SELECT * FROM participants WHERE conversation_id = $1 AND identity_id = $2",
            [conversationId, identityId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async listByConversation(conversationId: string): Promise<Participant[]> {
        const res = await db.query("SELECT * FROM participants WHERE conversation_id = $1", [conversationId]);
        return res.rows.map(this.mapToEntity);
    }

    async delete(conversationId: string, identityId: string): Promise<void> {
        await db.query("DELETE FROM participants WHERE conversation_id = $1 AND identity_id = $2", [conversationId, identityId]);
    }

    private mapToEntity(row: any): Participant {
        return {
            id: row.id,
            conversationId: row.conversation_id,
            identityId: row.identity_id,
            role: row.role,
            joinedAt: row.joined_at,
            encryptedSessionKey: row.encrypted_session_key,
        };
    }
}
