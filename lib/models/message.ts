import mongoose, { Schema, Document, Types } from 'mongoose';
import getDbConnection from '../handlers/getDbConnection';

export interface IMessage extends Document {
  chatroomId: Types.ObjectId;
  senderAid: string;
  senderUsername: string;
  content: string; // This will now be an encrypted blob
  signature?: string; // Signature of the encrypted blob
  timestamp: Date;
  replyTo?: {
    messageId: string;
    senderUsername: string;
    content: string;
  };
}

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
