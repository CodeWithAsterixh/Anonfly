import Permission from "../models/permission";
import { DEFAULT_FEATURES } from "../constants/features";

export const getPermissionsByUserId = async (userId: string) => {
  try {
    let permission = await Permission.findOne({ userId });
    
    // For now, if no permission record exists, we could return default features
    // or create a default record. Based on the requirements, it should be stored.
    if (!permission) {
      // Create a default 6-digit moderation token
      const moderationToken = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month validity

      permission = await Permission.create({
        userId,
        permissionCode: `PERM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        moderationToken,
        tokenExpiresAt: expiresAt,
        allowedFeatures: DEFAULT_FEATURES
      });
    }
    
    return permission;
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return null;
  }
};

export const hasFeature = (allowedFeatures: string[], feature: string): boolean => {
  return allowedFeatures.includes(feature);
};
