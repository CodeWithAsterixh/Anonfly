import pkg from 'express';
import { sessionStore } from '../helpers/sessionStore';

interface AuthenticatedRequest extends pkg.Request {
  userAid?: string;
  username?: string;
  session?: any;
}

const verifyToken = async (req: AuthenticatedRequest, res: pkg.Response, next: pkg.NextFunction) => {
  try {
    let token = req.header('Authorization')?.replace('Bearer ', '');

    // Support token in query params (useful for SSE/EventSource)
    // Also handle cases where token might be "null" or "undefined" as a string
    if ((!token || token === 'null' || token === 'undefined') && req.query.token) {
      token = req.query.token as string;
    }

    if (!token || token === 'null' || token === 'undefined') {
      throw new Error('Authentication failed: No session token provided');
    }

    const session = await sessionStore.get(token);

    if (!session) {
      throw new Error('Authentication failed: Invalid or expired session');
    }

    // Attach session data to request
    req.userAid = session.aid;
    req.username = session.username;
    req.session = session;

    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export { verifyToken };
