import { Document, Schema, Types } from "mongoose";
import getDbConnection from "../handlers/getDbConnection";

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
 * Interface representing a chat message.
 */
export interface IMessage {
  _id: Types.ObjectId;
  senderAid: string;
  senderUsername?: string;
  content: string;
  signature?: string;
  timestamp: Date;
  isEdited?: boolean;
  isDeleted?: boolean;
  replies?: Types.ObjectId[];
  reactions?: {
    userAid: string;
    username: string;
    emojiId: string;
    emojiValue: string;
    emojiType: string;
  }[];
  replyTo?: {
    messageId: string;
    userAid: string;
    username: string;
    content: string;
  };
}

/**
 * Interface representing a participant in a chatroom.
 */
export interface IParticipant {
  /** Unique identifier for the user (Anonfly ID) */
  userAid: string;
  /** Display name of the user */
  username: string;
  /** Ed25519 identity public key for signature verification */
  publicKey?: string;
  /** X25519 public key for E2EE key exchange */
  exchangePublicKey?: string;
  /** List of features allowed for this participant (e.g., 'upload', 'premium') */
  allowedFeatures?: string[];
  /** Timestamp when the user joined the room */
  joinedAt?: Date;
  /** Encrypted session key for E2EE communication */
  encryptedSessionKey?: string;
}

/**
 * Interface representing a banned user in a chatroom.
 */
export interface IBan {
  userAid: string;
  username: string;
  bannedAt: Date;
  reason?: string;
}

/**
 * Mongoose schema for a chatroom participant.
 */
const ParticipantSchema = new Schema<IParticipant>({
  userAid: { type: String, required: true },
  username: { type: String, required: true },
  publicKey: { type: String },
  exchangePublicKey: { type: String },
  allowedFeatures: [{ type: String }],
  joinedAt: { type: Date, default: Date.now },
  encryptedSessionKey: { type: String },
}, { _id: false });

/**
 * Interface representing a ChatRoom document in MongoDB.
 */
export interface IChatRoom extends Document {
  /** Display name of the chatroom */
  roomname: string;
  /** Optional description of the chatroom's purpose */
  description?: string;
  /** Geographic region for the chatroom (used for discovery) */
  region?: string;
  /** AID of the current room host (responsible for E2EE key distribution) */
  hostAid: string;
  /** AID of the room creator */
  creatorAid: string;
  /** List of current active participants */
  participants: IParticipant[];
  /** Embedded list of messages in this room */
  messages: IMessage[];
  /** List of banned users */
  bans: IBan[];
  /** Counter for message sequence IDs */
  messageSequenceCounter: number;
  /** E2EE room key, encrypted with the host's exchange public key */
  encryptedRoomKey?: string;
  /** Initialization vector used for encrypting the room key */
  roomKeyIv?: string;
  /** Hashed password for locked rooms */
  password?: string;
  /** Whether the room requires a password to join */
  isLocked: boolean;
  /** Whether the room is hidden from public listings */
  isPrivate: boolean;
}

/**
 * Mongoose schema for the ChatRoom model.
 */
const ChatRoomSchema = new Schema<IChatRoom>({
  roomname: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  region: { type: String }, // Optional region field
  hostAid: { type: String, required: true },
  creatorAid: { type: String, required: true },
  encryptedRoomKey: { type: String },
  roomKeyIv: { type: String },
  password: { type: String },
  isLocked: { type: Boolean, default: false },
  isPrivate: { type: Boolean, default: false },
  messageSequenceCounter: { type: Number, default: 0 },
  participants: [ParticipantSchema],
  bans: [new Schema({
    userAid: { type: String, required: true },
    username: { type: String, required: true },
    bannedAt: { type: Date, default: Date.now },
    reason: { type: String },
  }, { _id: false })],
  messages: [new Schema({
    senderAid: { type: String, required: true },
    senderUsername: { type: String }, // Add username to schema
    content: { type: String, required: true },
    signature: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }, // Add isDeleted to schema
    sequenceId: { type: Number, required: true },
    replies: [{ type: Types.ObjectId }], // Array of message IDs that are replies to this message
    reactions: [ReactionSchema], // Array of reactions to this message
    replyTo: ReplyToSchema, // Object containing details of the message this is a reply to
  })],
});

ChatRoomSchema.virtual('id').get(function(this: IChatRoom) {
  return this._id.toHexString();
});

const chatRoomConn = getDbConnection();
const ChatRoom = chatRoomConn.model('ChatRoom', ChatRoomSchema, "chatrooms");

export default ChatRoom;
