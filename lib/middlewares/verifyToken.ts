import pkg from 'express';
import { sessionStore } from '../helpers/sessionStore';

interface AuthenticatedRequest extends pkg.Request {
  session?: any;
}

const verifyToken = async (req: AuthenticatedRequest, res: pkg.Response, next: pkg.NextFunction) => {
  try {
    let token: string | undefined;

    // 1. Try to get token from Authorization header
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fallback to query parameter (useful for SSE/EventSource which doesn't support headers)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    // Sanitize token (handle "null" or "undefined" as strings)
    if (token === 'null' || token === 'undefined' || token === '') {
      token = undefined;
    }

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
