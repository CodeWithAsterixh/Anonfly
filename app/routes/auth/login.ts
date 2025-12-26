import User from '../../../lib/models/user.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../../../lib/constants/env.ts';

const loginRoute: RouteConfig = {
  method: 'post',
  path: '/login',
  handler: withErrorHandling(async ({ req, res }) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return {
        statusCode: 400,
        success: false,
        message: 'Please provide username and password',
      };
    }


    const user = await User.findOne({ username });
    if (!user) {
      return {
        statusCode: 404,
        success: false,
        message: 'User not found',
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        statusCode: 401,
        success: false,
        message: 'Invalid credentials',
      };
    }

    if (!env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    const token = jwt.sign({ userId: user._id }, env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Logged in successfully',
      data: { token, user:{
        username: user.username,
        userId: user._id,
        dateJoined: user.dateJoined,
        roomsJoined: user.roomsJoined
      } },
    };
  }),
};

export default loginRoute;
