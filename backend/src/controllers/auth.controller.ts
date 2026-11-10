import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { CSRF_COOKIE_NAME } from '../middleware/csrf.js';
import { AuthenticatedRequest } from '../types/auth.js';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    // Any passed role or status is ignored by the schema
    role: z.any().optional(),
    status: z.any().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register({
        email: req.body.email,
        password: req.body.password,
        fullName: req.body.fullName,
      });

      res.status(201).json({
        message: 'Account registered successfully. Your account is pending administrator onboarding approval.',
        user: result.user,
        account: result.account,
      });
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error.statusCode) {
        res.status(error.statusCode as number).json({
          error: error.code || 'REGISTRATION_FAILED',
          message: error.message,
        });
        return;
      }
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login({
        email: req.body.email,
        password: req.body.password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // 1. Set HttpOnly Session Cookie (inaccessible to JavaScript, immune to XSS theft)
      res.cookie(SESSION_COOKIE_NAME, result.rawSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: result.expiresAt,
        path: '/',
      });

      // 2. Set Double-Submit CSRF Cookie (accessible to client JavaScript to pass in header)
      res.cookie(CSRF_COOKIE_NAME, result.csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: result.expiresAt,
        path: '/',
      });

      res.setHeader('X-CSRF-Token', result.csrfToken);

      res.status(200).json({
        message: 'Authentication successful',
        user: result.user,
        csrfToken: result.csrfToken,
      });
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error.statusCode) {
        res.status(error.statusCode as number).json({
          error: error.code || 'AUTHENTICATION_FAILED',
          message: error.message,
        });
        return;
      }
      next(err);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionToken = req.cookies[SESSION_COOKIE_NAME];
      if (sessionToken && req.user) {
        await AuthService.logout(sessionToken, req.user.id);
      }

      // Clear both session and CSRF cookies
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

      res.status(200).json({
        message: 'Signed out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'You must be signed in',
        });
        return;
      }

      const userProfile = await AuthService.getMe(req.user.id);

      res.status(200).json({
        user: userProfile,
        csrfToken: req.csrfToken,
      });
    } catch (err) {
      next(err);
    }
  }
}
