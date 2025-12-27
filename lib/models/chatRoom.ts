import { Schema, model, Types, Document } from "mongoose";
import getDbConnection from "../handlers/getDbConnection";

const ReplyToSchema = new Schema({
  messageId: { type: Types.ObjectId, required: true },
  userId: { type: Types.ObjectId, required: true },
  username: { type: String, required: true },
}, { _id: false });

export interface IMessage {
  _id: Types.ObjectId; // Add _id for embedded documents
  senderUserId: Types.ObjectId;
  content: string;
  timestamp: Date;
  replies?: Types.ObjectId[];
  replyTo?: {
    messageId: Types.ObjectId;
    userId: Types.ObjectId;
    username: string;
  };
}

export interface IParticipant {
  userId: Types.ObjectId;
  username: string;
  joinedAt?: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  username: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

export interface IChatRoom extends Document {
  roomname: string;
  description?: string;
  hostUserId: Types.ObjectId;
  participants: IParticipant[];
  messages: IMessage[];
}

const ChatRoomSchema = new Schema<IChatRoom>({
  roomname: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  hostUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  participants: [ParticipantSchema],
  messages: [new Schema({
    senderUserId: { type: Types.ObjectId, required: true, ref: 'User' },
    content: { type: String, required: true },
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
