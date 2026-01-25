import { Document, Schema, Types } from 'mongoose';
import getDbConnection from '../handlers/getDbConnection';

/**
 * Schema for message reactions (emojis).
 */
const ReactionSchema = new Schema({
  userAid: { type: String, required: true },
  username: { type: String, required: true },
  emojiId: { type: String, required: true },
  emojiValue: { type: String, required: true },
  emojiType: { type: String, default: 'unicode' },
}, { _id: false });

/**
 * Schema for referencing a message that another message is replying to.
 */
const ReplyToSchema = new Schema({
  messageId: { type: String, required: true },
  userAid: { type: String, required: true },
  username: { type: String, required: true },
  content: { type: String, required: true }, // Store content for quick preview without extra lookups
}, { _id: false });

/**
 * Interface representing a standalone Message document.
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
  /** Incremental sequence ID for the message within the chatroom */
  sequenceId: number;
  /** Whether the message has been edited */
  isEdited: boolean;
  /** Whether the message has been soft-deleted */
  isDeleted: boolean;
  /** Array of message IDs that are replies to this message */
  replies: Types.ObjectId[];
  /** Array of reactions to this message */
  reactions: {
    userAid: string;
    username: string;
    emojiId: string;
    emojiValue: string;
    emojiType: string;
  }[];
  /** Reference to a message being replied to */
  replyTo?: {
    messageId: string;
    userAid: string;
    senderUsername: string;
    username?: string; // Align with different usages
    content: string;
  };
}

/**
 * Mongoose schema for the standalone Message model.
 */
const MessageSchema: Schema = new Schema({
  chatroomId: { type: Schema.Types.ObjectId, required: true, ref: 'ChatRoom', index: true },
  senderAid: { type: String, required: true },
  senderUsername: { type: String, required: true },
  content: { type: String, required: true },
  signature: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  sequenceId: { type: Number, required: true },
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  replies: [{ type: Schema.Types.ObjectId }],
  reactions: [ReactionSchema],
  replyTo: ReplyToSchema
});

// Compound index to ensure uniqueness of sequenceId per chatroom and optimize queries
MessageSchema.index({ chatroomId: 1, sequenceId: 1 }, { unique: true });
MessageSchema.index({ chatroomId: 1, timestamp: 1 });

const messageConn = getDbConnection();
const Message = messageConn.model<IMessage>('Message', MessageSchema, 'messages');

export default Message;
