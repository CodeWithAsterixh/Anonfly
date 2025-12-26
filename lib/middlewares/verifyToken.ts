import pkg from 'express';
import jwt from 'jsonwebtoken';
import env from '../constants/env.ts';
import User from '../models/user.ts';

interface AuthenticatedRequest extends pkg.Request {
  user?: any;
}

const verifyToken = async (req: AuthenticatedRequest, res: pkg.Response, next: pkg.NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Authentication failed: No token provided');
    }

    if (!env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    const decoded: any = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await User.findOne({ _id: decoded.userId });

    if (!user) {
      throw new Error('Authentication failed: User not found');
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export { verifyToken };