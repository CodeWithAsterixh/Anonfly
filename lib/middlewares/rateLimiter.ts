import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import logger from './logger';
import env from '../constants/env';

/**
 * Standard rate limiter using express-rate-limit.
 * This handles the HTTP-level protection.
 * 
 * Note on WebSockets/SSE: 
 * - For WebSockets, this only limits the initial handshake (HTTP Upgrade).
 * - For SSE, this only limits the initial request to open the stream.
 * - Long-lived connections are not penalized for staying open.
 */

let redisClient: Redis | undefined;

if (env.REDIS_URL) {
  try {
    redisClient = new Redis(env.REDIS_URL);
    logger.app.info('Rate Limiter: Redis client initialized');
  } catch (error) {
    logger.app.error({ err: error }, 'Rate Limiter: Failed to initialize Redis client');
  }
}

/**
 * Factory function to create a standard rate limiter using express-rate-limit.
 * This handles HTTP-level protection against brute-force and DoS.
 * 
 * @param {number} limit - Maximum number of requests allowed in the window.
 * @param {number} windowMs - Time window in milliseconds.
 * @returns {RequestHandler} Express middleware.
 */
export const rateLimiter = (limit: number = 100, windowMs: number = 60 * 1000) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // Use standard headers for rate limit info
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }, // Disable x-forwarded-for validation as it's checked manually or via trust proxy
    store: redisClient ? new RedisStore({
      // @ts-ignore - ioredis call signature match
      sendCommand: (...args: string[]) => redisClient!.call(...args),
    }) : undefined,
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

/**
 * Limit room creation to 5 per hour per IP.
 */
export const createRoomLimiter = rateLimiter(5, 60 * 60 * 1000);

/**
 * Limit authentication attempts to 10 per 5 minutes per IP.
 */
export const authLimiter = rateLimiter(10, 5 * 60 * 1000);

/**
 * Limit premium status checks to 10 per 2 hours per IP.
 */
export const premiumCheckLimiter = rateLimiter(10, 2 * 60 * 60 * 1000);

/**
 * Limit HTTP-based message operations to 30 per 10 seconds.
 */
export const messageLimiter = rateLimiter(30, 10 * 1000);
