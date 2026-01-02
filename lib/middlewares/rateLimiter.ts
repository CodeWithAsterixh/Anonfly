import { rateLimit } from 'express-rate-limit';
import logger from './logger';

/**
 * Standard rate limiter using express-rate-limit.
 * This handles the HTTP-level protection.
 * 
 * Note on WebSockets/SSE: 
 * - For WebSockets, this only limits the initial handshake (HTTP Upgrade).
 * - For SSE, this only limits the initial request to open the stream.
 * - Long-lived connections are not penalized for staying open.
 */

export const rateLimiter = (limit: number = 100, windowMs: number = 60 * 1000) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // Use standard headers for rate limit info
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later.',
      status: 'bad',
    },
    handler: (req, res, next, options) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      logger.api.warn(`[RateLimit] Blocked request from ${ip} to ${req.path}`);
      res.status(options.statusCode).send(options.message);
    },
    // Ensure we handle proxies correctly (like Vercel/Cloudflare)
    keyGenerator: (req) => {
      return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    },
  });
};

// Specialized limiters
export const createRoomLimiter = rateLimiter(5, 60 * 60 * 1000); // 5 rooms per hour
export const authLimiter = rateLimiter(10, 5 * 60 * 1000); // 10 auth attempts per 5 mins
export const premiumCheckLimiter = rateLimiter(10, 2 * 60 * 60 * 1000); // 1 request per 2 hours
export const messageLimiter = rateLimiter(30, 10 * 1000); // 30 messages per 10 seconds (for HTTP-based message sending)
