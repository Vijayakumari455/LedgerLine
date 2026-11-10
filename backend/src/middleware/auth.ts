import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { hashToken } from '../utils/crypto.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { UserStatus } from '../constants/roles.js';
import { CSRF_COOKIE_NAME } from './csrf.js';

export const SESSION_COOKIE_NAME = 'ledgerline_session';

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionToken = req.cookies[SESSION_COOKIE_NAME];

  if (!sessionToken || typeof sessionToken !== 'string') {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication session token is missing or invalid',
    });
    return;
  }

  const tokenHash = hashToken(sessionToken);

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      res.status(401).json({
        error: 'INVALID_SESSION',
        message: 'Session is invalid or has expired',
      });
      return;
    }

    if (session.isRevoked) {
      res.status(401).json({
        error: 'SESSION_REVOKED',
        message: 'This session has been revoked. Please sign in again.',
      });
      return;
    }

    if (new Date() > session.expiresAt) {
      res.status(401).json({
        error: 'SESSION_EXPIRED',
        message: 'Session has expired. Please sign in again.',
      });
      return;
    }

    if (session.user.status === UserStatus.SUSPENDED) {
      res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended by an administrator.',
      });
      return;
    }

    // Attach verified user identity & CSRF token to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      status: session.user.status,
      sessionId: session.id,
    };
    req.csrfToken = session.csrfToken;

    // Refresh non-HttpOnly CSRF cookie for client header consumption
    res.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    next();
  } catch (err) {
    console.error('[AuthMiddleware Error]', err);
    res.status(500).json({
      error: 'INTERNAL_AUTH_ERROR',
      message: 'Failed to verify authentication session',
    });
  }
}
