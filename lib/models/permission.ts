import { Schema, model, Document } from "mongoose";
import getDbConnection from "../handlers/getDbConnection";

/**
 * Interface representing User Permissions and Moderation status.
 */
export interface IPermission extends Document {
  /** The unique AID of the user */
  userId: string;
  /** Unique code identifying the user's permission level/status */
  permissionCode: string;
  /** A short-lived 6-digit token used for moderation authentication */
  moderationToken: string;
  /** Expiration timestamp for the moderation token */
  tokenExpiresAt: Date;
  /** List of premium features the user has access to */
  allowedFeatures: string[];
  /** Auto-generated timestamp for last update */
  updatedAt: Date;
  /** Auto-generated timestamp for creation */
  createdAt: Date;
}

/**
 * Mongoose schema for the Permission model.
 */
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
