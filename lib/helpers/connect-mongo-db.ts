// filepath: c:\Users\Asterixh\Desktop\elberythstore\server\utils\connect-mongo-db.ts
import mongoose from "mongoose";
import checkHttpConnectivity from "./ping.ts";
import env from "../constants/env.ts";
export default async function connectMongoDb(db_name="") {
  const isOnline = await checkHttpConnectivity();
  const rawUri = env.MONGODB_URI;
  let response = {
    connectionActivity: isOnline ? "online" : "offline",
    status: isOnline?"good" : "bad",
    statusCode: 500,
    message: "",
    mongoDbStatus: "offline",
  };

  if (!isOnline) {
    response.message = "can't connect to the internet, you are offline";
    response.statusCode = 503;
    return response;
  }

  if (!rawUri) {
    response.message = "No mongo Uri found, please provide the MONGODB_URI";
    response.statusCode = 503;
    return response;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(rawUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        dbName: db_name
      });
    }

    // Check if the connection is successful
    if (mongoose.connection.readyState === 1) {
      response.message = "MongoDB connected successfully";
      response.mongoDbStatus = "online";
      response.statusCode = 200;
    } else {
      response.message = "MongoDB connection failed";
      response.mongoDbStatus = "offline";
      response.statusCode = 500;
    }
    return response;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    response.message = error instanceof Error ? error.message : "Something went wrong while connecting to mongo db";
    response.mongoDbStatus = "offline";
    return response;
  }
}