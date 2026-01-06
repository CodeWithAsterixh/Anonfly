import mongoose from "mongoose";
import env from "../constants/env";

/**
 * Cache for database connections to prevent multiple connections to the same database.
 */
const connections: Record<string, mongoose.Connection> = {};

/**
 * Returns a Mongoose connection to the primary "Anonfly" database.
 * Uses a singleton pattern to ensure only one connection is created per process.
 * 
 * @returns {mongoose.Connection} The Mongoose connection instance.
 * @throws {Error} If MONGODB_URI is not defined in the environment.
 * 
 * @example
 * const db = getDbConnection();
 * const MyModel = db.model('MyModel', mySchema);
 */
export default function getDbConnection(): mongoose.Connection {
  const dbName = "Anonfly"; // Always connect to the Anonfly database
  if (connections[dbName]) {
    return connections[dbName];
  }
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error("No MONGODB_URI found");
  const conn = mongoose.createConnection(uri, { dbName });
  connections[dbName] = conn;
  return conn;
}