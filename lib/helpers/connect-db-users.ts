import User from "../models/user.ts";
import connectMongoDb from "./connect-mongo-db.ts";
import useMongoDb from "./use-mongo-db.ts";

export default async function connectDbUsers () {
    const dbResponse = await connectMongoDb("users");
    if (dbResponse.mongoDbStatus === "online") {
         await User.syncIndexes();
        return useMongoDb("users");
    } else {
        console.error("Failed to connect to MongoDB:", dbResponse.message);
        throw new Error("Failed to connect to MongoDB");
    }
}