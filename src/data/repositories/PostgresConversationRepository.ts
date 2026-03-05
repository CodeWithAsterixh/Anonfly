import { db } from "../database/PostgresClient";
import { IConversationRepository } from "../../business/logic/interfaces/IConversationRepository";
import { Conversation } from "../../business/entities/Conversation";

export class PostgresConversationRepository implements IConversationRepository {
    async findById(id: string): Promise<Conversation | null> {
        const res = await db.query("SELECT * FROM conversations WHERE id = $1", [id]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async findByName(roomName: string): Promise<Conversation | null> {
        const res = await db.query("SELECT * FROM conversations WHERE room_name = $1", [roomName]);
        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async save(c: Conversation): Promise<Conversation> {
        const res = await db.query(
            `INSERT INTO conversations (
        room_name, description, region, host_aid, creator_aid, 
        encrypted_room_key, room_key_iv, is_locked, password_hash, is_private
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
            [
                c.roomName, c.description, c.region, c.hostAid, c.creatorAid,
                c.encryptedRoomKey, c.roomKeyIv, c.isLocked, c.passwordHash, c.isPrivate
            ]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async update(c: Conversation): Promise<Conversation> {
        const res = await db.query(
            `UPDATE conversations SET 
        room_name = $1, description = $2, region = $3, host_aid = $4, creator_aid = $5, 
        encrypted_room_key = $6, room_key_iv = $7, is_locked = $8, password_hash = $9, is_private = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *`,
            [
                c.roomName, c.description, c.region, c.hostAid, c.creatorAid,
                c.encryptedRoomKey, c.roomKeyIv, c.isLocked, c.passwordHash, c.isPrivate,
                c.id
            ]
        );
        return this.mapToEntity(res.rows[0]);
    }

    async delete(id: string): Promise<void> {
        await db.query("DELETE FROM conversations WHERE id = $1", [id]);
    }

    async listPublic(region?: string): Promise<Conversation[]> {
        let query = "SELECT * FROM conversations WHERE is_private = FALSE";
        let params = [];
        if (region) {
            query += " AND region = $1";
            params.push(region);
        }
        const res = await db.query(query, params);
        return res.rows.map(this.mapToEntity);
    }

    private mapToEntity(row: any): Conversation {
        return new Conversation(
            row.id,
            row.room_name,
            row.host_aid,
            row.creator_aid,
            row.description,
            row.region,
            row.encrypted_room_key,
            row.room_key_iv,
            row.is_locked,
            row.password_hash,
            row.is_private,
            row.created_at,
            row.updated_at
        );
    }
}
