import mongoose, { Schema, Document, Types } from 'mongoose';
import getDbConnection from '../handlers/getDbConnection.ts';

export interface IMessage extends Document {
  chatroomId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderUsername: string;
  content: string;
  timestamp: Date;
}

const MessageSchema: Schema = new Schema({
  chatroomId: { type: Schema.Types.ObjectId, required: true, ref: 'ChatRoom' },
  senderId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  senderUsername: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const messageConn = getDbConnection();
const Message = messageConn.model<IMessage>('Message', MessageSchema, 'messages');

export default Message;
