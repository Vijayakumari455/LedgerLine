import { Request, Response, NextFunction } from 'express';
import { getCacheClient } from '../config/redis.js';

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  errorMessage?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowSeconds, maxRequests, keyPrefix, errorMessage } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cache = getCacheClient();

      // Identify client by IP (or authenticated user ID if present)
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `ratelimit:${keyPrefix}:${clientIp}`;

      const requestCount = await cache.incr(key, windowSeconds);

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestCount).toString());

      if (requestCount > maxRequests) {
        res.setHeader('Retry-After', windowSeconds.toString());
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: errorMessage || 'Too many requests. Please slow down and try again later.',
          retryAfterSeconds: windowSeconds,
        });
        return;
      }

      next();
    } catch (err) {
      // In non-production or if redis transiently fails, log error and allow request through
      console.error('[RateLimiter Error]', (err as Error).message);
      next();
    }
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter({
  windowSeconds: 900, // 15 minutes
  maxRequests: 5,     // 5 attempts
  keyPrefix: 'auth_login',
  errorMessage: 'Too many authentication attempts. Please try again in 15 minutes.',
});

export const apiRateLimiter = createRateLimiter({
  windowSeconds: 60,  // 1 minute
  maxRequests: 100,   // 100 requests
  keyPrefix: 'general_api',
});
