import pkg from 'express';
import { sessionStore } from '../helpers/sessionStore';

interface AuthenticatedRequest extends pkg.Request {
  session?: any;
}

const verifyToken = async (req: AuthenticatedRequest, res: pkg.Response, next: pkg.NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Authentication failed: No session token provided');
    }

    const session = sessionStore.get(token);

    if (!session) {
      throw new Error('Authentication failed: Invalid or expired session');
    }

    // Attach session data to request
    (req as any).userAid = session.aid;
    (req as any).username = session.username;
    (req as any).session = session;

    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export { verifyToken };
