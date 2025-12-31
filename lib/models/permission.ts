import { Schema, model, Document } from "mongoose";
import getDbConnection from "../handlers/getDbConnection";

export interface IPermission extends Document {
  userId: string;
  permissionCode: string;
  moderationToken: string; // The 6-digit code
  tokenExpiresAt: Date;
  allowedFeatures: string[];
  updatedAt: Date;
  createdAt: Date;
}

const PermissionSchema = new Schema<IPermission>({
  userId: { type: String, required: true, index: true },
  permissionCode: { type: String, required: true, unique: true },
  moderationToken: { type: String, required: true, index: true },
  tokenExpiresAt: { type: Date, required: true },
  allowedFeatures: { type: [String], default: [] },
}, { 
  timestamps: true 
});

// Use the dynamic connection handler
const Permission = getDbConnection().model<IPermission>("Permission", PermissionSchema);

export default Permission;
