import pkg from 'express';
import { sessionStore } from '../helpers/sessionStore';

interface AuthenticatedRequest extends pkg.Request {
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
      console.warn(`[Auth] No token provided for ${req.method} ${req.path}`);
      throw new Error('Authentication failed: No session token provided');
    }

    const session = sessionStore.get(token);

    if (!session) {
      console.warn(`[Auth] Invalid or expired token for ${req.method} ${req.path}: ${token.substring(0, 8)}...`);
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
