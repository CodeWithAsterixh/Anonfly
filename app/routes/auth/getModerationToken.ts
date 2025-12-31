import withErrorHandling from "../../../lib/middlewares/withErrorHandling";
import { verifyToken } from "../../../lib/middlewares/verifyToken";
import { getPermissionsByUserId } from "../../../lib/helpers/permissionHelper";
import type { RouteConfig } from '../../../types/index.d';

const getMyModerationTokenRoute: Omit<RouteConfig, 'app'> = {
  method: 'get',
  path: '/user/moderation-token',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
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

    if (!permission) {
      return {
        message: 'No moderation data found for this user',
        statusCode: 404,
        success: false,
        status: 'bad',
      };
    }

    return {
      message: 'Moderation token fetched successfully',
      statusCode: 200,
      success: true,
      status: 'good',
      data: {
        token: permission.moderationToken,
        expiresAt: permission.tokenExpiresAt
      }
    };
  }),
};

export default getMyModerationTokenRoute;
