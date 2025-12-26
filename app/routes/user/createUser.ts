import User from '../../../lib/models/user.ts';
import withErrorHandling from '../../../lib/middlewares/withErrorHandling.ts';
import type { RouteConfig } from '../../../types/index.d.ts';
import bcrypt from 'bcrypt';

const createUserRoute: RouteConfig = {
  method: 'post',
  path: '/users',
  handler: withErrorHandling(async ({ req, res }) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return {
        statusCode: 400,
        success: false,
        message: 'Please provide username, and password',
      };
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return {
        statusCode: 409,
        success: false,
        message: 'Username already exists',
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
    });

    await newUser.save();

    return {
      statusCode: 201,
      success: true,
      message: 'User created successfully',
      data: { userId: newUser._id, username: newUser.username },
    };
  }),
};

export default createUserRoute;