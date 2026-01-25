import { Document, Schema, Types } from 'mongoose';
import getDbConnection from '../handlers/getDbConnection';

/**
 * Interface representing a standalone Message document.
 * Note: Messages are primarily stored embedded within ChatRoom documents,
 * but this model provides a way to query messages independently if needed.
 */
export interface IMessage extends Document {
  /** Reference to the chatroom this message belongs to */
  chatroomId: Types.ObjectId;
  /** Unique identifier of the sender */
  senderAid: string;
  /** Display name of the sender at the time of sending */
  senderUsername: string;
  /** Encrypted message content (Base64 string) */
  content: string;
  /** Ed25519 signature for verifying message integrity and authenticity */
  signature?: string;
  /** Timestamp when the message was sent */
  timestamp: Date;
  /** Reference to a message being replied to */
  replyTo?: {
    messageId: string;
    senderUsername: string;
    content: string;
  };
}

/**
 * Mongoose schema for the standalone Message model.
 */
const MessageSchema: Schema = new Schema({
  chatroomId: { type: Schema.Types.ObjectId, required: true, ref: 'ChatRoom' },
  senderAid: { type: String, required: true },
  senderUsername: { type: String, required: true },
  content: { type: String, required: true },
  signature: { type: String },
  timestamp: { type: Date, default: Date.now },
  replyTo: {
    messageId: { type: String },
    senderUsername: { type: String },
    content: { type: String }
  }
});

const messageConn = getDbConnection();
const Message = messageConn.model<IMessage>('Message', MessageSchema, 'messages');

export default Message;
