import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from '../utils/crypto.js';
import { AuthenticatedRequest } from '../types/auth.js';

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes exempted from CSRF (unauthenticated initial entry points)
const EXEMPT_PATHS = new Set([
  '/api/health',
  '/api/ready',
  '/api/auth/register',
  '/api/auth/login',
]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 1. Safe HTTP methods do not modify state
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 2. Check path exemptions
  if (EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const authReq = req as AuthenticatedRequest;

  // 3. Extract CSRF token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  const cookieToken = req.cookies[CSRF_COOKIE_NAME] as string | undefined;
  const sessionToken = authReq.csrfToken;

  const expectedToken = sessionToken || cookieToken;

  if (!headerToken || !expectedToken) {
    res.status(403).json({
      error: 'CSRF_TOKEN_MISSING',
      message: 'Cross-Site Request Forgery (CSRF) token is missing from request headers',
    });
    return;
  }

  // 4. Timing-safe comparison to prevent side-channel timing leaks
  if (!timingSafeEqual(headerToken, expectedToken)) {
    res.status(403).json({
      error: 'CSRF_TOKEN_MISMATCH',
      message: 'Invalid Cross-Site Request Forgery (CSRF) token',
    });
    return;
  }

  next();
}
