import { Schema } from "mongoose";


import getDbConnection from "../handlers/getDbConnection.ts";



const UserSchema = new Schema({
  username: {type: String, required: true, minlength: 4},
  password: {
    type: String,
    required: true,
    match: [
      /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
      "unsecure password, must have at least, an uppercase letter, a number and a symbol",
    ],
    minlength: 8, // standard secure password is commonly 8,
  },
  dateJoined: { type: Date, default: Date.now },
  roomsJoined: [{ type: Schema.Types.ObjectId, ref: 'ChatRoom' }],
});

UserSchema.virtual('id').get(function() {
  return this._id.toHexString();
});







// 5. Increment failed login


UserSchema.set("toJSON", {
  transform(_doc: any, ret: any) {
    delete ret.password;
    delete ret.__v;
  },
});

const userConn = getDbConnection();

const User = userConn.models.User || userConn.model("User", UserSchema, "users");

export default User;
