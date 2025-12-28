import { Schema, model, Types, Document } from "mongoose";
import getDbConnection from "../handlers/getDbConnection";

const ReplyToSchema = new Schema({
  messageId: { type: Types.ObjectId, required: true },
  userAid: { type: String, required: true },
  username: { type: String, required: true },
}, { _id: false });

export interface IMessage {
  _id: Types.ObjectId; // Add _id for embedded documents
  senderAid: string;
  content: string;
  signature?: string; // Add signature for verification
  timestamp: Date;
  replies?: Types.ObjectId[];
  replyTo?: {
    messageId: Types.ObjectId;
    userAid: string;
    username: string;
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
    content: { type: String, required: true },
    signature: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    replies: [{ type: Types.ObjectId }], // Array of message IDs that are replies to this message
    replyTo: ReplyToSchema, // Object containing details of the message this is a reply to
  })],
});

ChatRoomSchema.virtual('id').get(function(this: IChatRoom) {
  return this._id.toHexString();
});

const chatRoomConn = getDbConnection();
const ChatRoom = chatRoomConn.model('ChatRoom', ChatRoomSchema, "chatrooms");

export default ChatRoom;
