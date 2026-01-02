import { LRUCache } from 'lru-cache';
import type { Request, Response, NextFunction } from 'express';

const options = {
  max: 500,
  // How long to store the rate limit info (in milliseconds)
  ttl: 60 * 1000,
};

const cache = new LRUCache<string, number>(options);

export const rateLimiter = (limit: number = 100, windowMs: number = 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Try to get real IP from proxy headers first, then fallback to remoteAddress
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;

    const currentUsage = cache.get(key) || 0;

    if (currentUsage >= limit) {
      console.warn(`[RateLimit] Blocked ${key}. Usage: ${currentUsage + 1}/${limit}`);
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        status: 'bad',
      });
    }

    cache.set(key, currentUsage + 1, { ttl: windowMs });
    next();
  };
};
