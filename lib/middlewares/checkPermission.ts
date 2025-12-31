import { FEATURES } from "../constants/features";
import { getPermissionsByUserId, hasFeature } from "../helpers/permissionHelper";
import { normalizeError } from "../helpers/normalizeError";

export const checkPermission = (feature: FEATURES) => {
  return async (event: any) => {
    const { req } = event;
    const userAid = (req as any)?.userAid;

    if (!userAid) {
      return {
        message: 'User not authenticated',
        statusCode: 401,
        success: false,
        status: 'bad',
      };
    }

    const permission = await getPermissionsByUserId(userAid);

    if (!permission || !hasFeature(permission.allowedFeatures, feature)) {
      return {
        message: `Permission denied: Feature ${feature} is not available for your account.`,
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    // Continue to the next handler
    return null;
  };
};
