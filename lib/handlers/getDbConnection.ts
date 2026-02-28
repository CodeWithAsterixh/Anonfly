import mongoose from "mongoose";
import env from "../constants/env";
import dns from "node:dns";
import logger from "../middlewares/logger";

// Use a reliable DNS server to resolve SRV records if possible
// This is often needed when the default DNS doesn't support SRV lookups (needed for mongodb+srv://)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn("Could not set custom DNS servers:", e);
}

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
  
  const conn = mongoose.createConnection(uri, { 
    dbName,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s if can't connect
    socketTimeoutMS: 45000,
  });

  conn.on('connected', () => logger.db.info(`MongoDB connected to ${dbName}`));
  conn.on('error', (err) => logger.db.error({ err }, 'MongoDB connection error'));

  connections[dbName] = conn;
  return conn;
}
