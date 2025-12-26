import User from '../../../lib/models/user.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import jwt from 'jsonwebtoken';
import env from '../../../lib/constants/env.ts';

const getUserRoute: RouteConfig = {
  method: 'get',
  path: '/auth/user',
  handler: withErrorHandling(async ({ req, res }) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        success: false,
        message: 'Authorization token missing or invalid',
      };
    }

    const token = authHeader.split(' ')[1];

    if (!env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    try {
      const decoded: any = jwt.verify(token, env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.userId).select('-password'); // Exclude password

      if (!user) {
        return {
          statusCode: 404,
          success: false,
          message: 'User not found',
        };
      }

      return {
        statusCode: 200,
        success: true,
        message: 'User data retrieved successfully',
        data: {
        username: user.username,
        userId: user._id,
        dateJoined: user.dateJoined,
        roomsJoined: user.roomsJoined
      },
      };
    } catch (error: any) {
      return {
        statusCode: 401,
        success: false,
        message: 'Invalid or expired token',
      };
    }
  }),
};

export default getUserRoute;
