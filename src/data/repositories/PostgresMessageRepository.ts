import { db } from "../database/PostgresClient";
import { IMessageRepository } from "../../business/logic/interfaces/IMessageRepository";
import { Message } from "../../business/entities/Message";

export class PostgresMessageRepository implements IMessageRepository {
    async findById(id: string): Promise<Message | null> {
        const res = await db.query(`
      SELECT m.*, i.user_aid as sender_aid, i.username as sender_username,
      COALESCE(
          (SELECT json_agg(json_build_object(
              'userAid', ri.user_aid,
              'username', ri.username,
              'emojiId', r.emoji_id,
              'emojiValue', r.emoji_value,
              'emojiType', r.emoji_type
          )) FROM reactions r 
           JOIN identities ri ON r.identity_id = ri.id
           WHERE r.message_id = m.id
          ), '[]'
      ) as reactions
      FROM messages m
      JOIN identities i ON m.sender_id = i.id
      WHERE m.id = $1
    `, [id]);

        if (res.rows.length === 0) return null;
        return this.mapToEntity(res.rows[0]);
    }

    async save(m: Message): Promise<Message> {
        const res = await db.query(
            `INSERT INTO messages (conversation_id, sender_id, content, signature, sequence_id, reply_to_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [m.conversationId, m.senderId, m.content, m.signature, m.sequenceId, m.replyToId, m.timestamp]
        );
        // Re-fetch to get sender details
        return this.findById(res.rows[0].id) as Promise<Message>;
    }

    async findByConversationId(conversationId: string, limit: number = 50, before?: Date): Promise<Message[]> {
        let query = `
      SELECT m.*, i.user_aid as sender_aid, i.username as sender_username,
      COALESCE(
          (SELECT json_agg(json_build_object(
              'userAid', ri.user_aid,
              'username', ri.username,
              'emojiId', r.emoji_id,
              'emojiValue', r.emoji_value,
              'emojiType', r.emoji_type
          )) FROM reactions r 
           JOIN identities ri ON r.identity_id = ri.id
           WHERE r.message_id = m.id
          ), '[]'
      ) as reactions
      FROM messages m
      JOIN identities i ON m.sender_id = i.id
      WHERE m.conversation_id = $1
    `;
        let params: any[] = [conversationId];

        if (before) {
            query += " AND m.timestamp < $2";
            params.push(before);
        }

        query += ` ORDER BY m.sequence_id DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const res = await db.query(query, params);
        return res.rows.map(row => this.mapToEntity(row));
    }

    async getLatestSequenceId(conversationId: string): Promise<number> {
        const res = await db.query(
            "SELECT MAX(sequence_id) as latest FROM messages WHERE conversation_id = $1",
            [conversationId]
        );
        return res.rows[0]?.latest || 0;
    }

    async softDelete(id: string): Promise<void> {
        await db.query("UPDATE messages SET is_deleted = TRUE WHERE id = $1", [id]);
    }

    async update(id: string, content: string, isEdited: boolean): Promise<void> {
        await db.query("UPDATE messages SET content = $1, is_edited = $2 WHERE id = $3", [content, isEdited, id]);
    }

    async addReaction(messageId: string, identityId: string, emojiId: string, emojiValue: string, emojiType: string): Promise<void> {
        await db.query(
            `INSERT INTO reactions (message_id, identity_id, emoji_id, emoji_value, emoji_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (message_id, identity_id, emoji_id) DO UPDATE SET emoji_value = $4, emoji_type = $5`,
            [messageId, identityId, emojiId, emojiValue, emojiType]
        );
    }

    async removeReaction(messageId: string, identityId: string, emojiId: string): Promise<void> {
        await db.query(
            "DELETE FROM reactions WHERE message_id = $1 AND identity_id = $2 AND emoji_id = $3",
            [messageId, identityId, emojiId]
        );
    }

    private mapToEntity(row: any): Message {
        return new Message(
            row.id,
            row.conversation_id,
            row.sender_id,
            row.content,
            row.timestamp,
            row.sequence_id,
            row.signature,
            row.is_edited,
            row.is_deleted,
            row.reply_to_id,
            row.sender_aid,
            row.sender_username,
            row.reactions || []
        );
    }
}
