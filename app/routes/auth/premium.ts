import withErrorHandling from '../../../lib/middlewares/withErrorHandling';
import type { RouteConfig } from '../../../types/index.d';
import { getPermissionsByUserId, hasFeature } from '../../../lib/helpers/permissionHelper';
import { verifyToken } from '../../../lib/middlewares/verifyToken';
import { premiumCheckLimiter } from '../../../lib/middlewares/rateLimiter';

const premiumRoute: Omit<RouteConfig, 'app'> = {
  method: 'get',
  path: '/auth/premium-status',
  middleware: [verifyToken, premiumCheckLimiter],
  handler: withErrorHandling(async (event) => {
    const { req } = event;
    const userAid = req.userAid;

    if (!userAid) {
      return {
        message: 'Unauthorized',
        statusCode: 401,
        success: false,
        status: 'bad',
      };
    }

    // Get user permissions/features from DB
    const permissions = await getPermissionsByUserId(userAid);
    const allowedFeatures = permissions ? permissions.allowedFeatures : [];
    const isPremium = hasFeature(allowedFeatures, 'CREATE_PRIVATE_ROOM');

    return {
      message: 'Premium status fetched successfully',
      statusCode: 200,
      success: true,
      status: 'good',
      data: { 
        allowedFeatures,
        isPremium
      },
    };
  }),
};

export default premiumRoute;
