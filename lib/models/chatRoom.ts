import { Schema, model, Types, Document } from "mongoose";
import getDbConnection from "../handlers/getDbConnection";

const ReactionSchema = new Schema({
  userAid: { type: String, required: true },
  username: { type: String, required: true },
  emojiId: { type: String, required: true },
  emojiValue: { type: String, required: true },
  emojiType: { type: String, default: 'unicode' },
}, { _id: false });

const ReplyToSchema = new Schema({
  messageId: { type: String, required: true },
  userAid: { type: String, required: true },
  username: { type: String, required: true },
  content: { type: String, required: true }, // Store content for quick preview without extra lookups
}, { _id: false });

export interface IMessage {
  _id: Types.ObjectId; // Add _id for embedded documents
  senderAid: string;
  senderUsername?: string; // Add username for easier rendering
  content: string;
  signature?: string; // Add signature for verification
  timestamp: Date;
  isEdited?: boolean;
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

export interface IParticipant {
  userAid: string;
  username: string;
  publicKey?: string; // Identity Public Key
  exchangePublicKey?: string; // Exchange Public Key
  joinedAt?: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userAid: { type: String, required: true },
  username: { type: String, required: true },
  publicKey: { type: String },
  exchangePublicKey: { type: String },
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

export interface IChatRoom extends Document {
  roomname: string;
  description?: string;
  hostAid: string;
  participants: IParticipant[];
  messages: IMessage[];
  encryptedRoomKey?: string; // Encrypted for the host
  roomKeyIv?: string;
  password?: string; // Hashed password
  isLocked: boolean;
}

const ChatRoomSchema = new Schema<IChatRoom>({
  roomname: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  hostAid: { type: String, required: true },
  encryptedRoomKey: { type: String },
  roomKeyIv: { type: String },
  password: { type: String },
  isLocked: { type: Boolean, default: false },
  participants: [ParticipantSchema],
  messages: [new Schema({
    senderAid: { type: String, required: true },
    senderUsername: { type: String }, // Add username to schema
    content: { type: String, required: true },
    signature: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    isEdited: { type: Boolean, default: false },
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
