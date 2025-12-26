import User from '../../../lib/models/user.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import { verifyToken } from '../../../lib/middlewares/verifyToken.ts';

const deleteUserRoute: Omit<RouteConfig, 'app'> = {
  method: 'delete',
  path: '/users/:userId',
  middleware: [verifyToken],
  handler: withErrorHandling(async (event) => {
    const { params, req } = event;
    const { userId } = params;

    // Ensure the authenticated user is trying to delete their own account or is an admin
    // For simplicity, we'll allow a user to delete their own account for now.
    if ((req.user as any)._id.toString() !== userId) {
      return {
        message: 'Unauthorized: You can only delete your own account.',
        statusCode: 403,
        success: false,
        status: 'bad',
      };
    }

    try {
      const result = await User.findByIdAndDelete(userId);

      if (!result) {
        return {
          message: 'User not found',
          statusCode: 404,
          success: false,
          status: 'bad',
        };
      }

      return {
        message: 'User deleted successfully',
        statusCode: 200,
        success: true,
        status: 'good',
      };
    } catch (error) {
      throw error; // Re-throw other errors for withErrorHandling to catch
    }
  }),
};

export default deleteUserRoute;
