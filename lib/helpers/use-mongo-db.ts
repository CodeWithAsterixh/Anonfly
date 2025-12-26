import mongoose from "mongoose";

export default function (db_name = "") {
  return mongoose.connection.useDb(db_name);
}