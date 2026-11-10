import { Response, NextFunction } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.js';

/**
 * Server-Enforced Role-Based Access Control:
 * Never trusts client-supplied roles. Validates role strictly from authenticated session.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'You must be signed in to perform this action',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Access denied. Required role: [${allowedRoles.join(', ')}]. Your role: ${req.user.role}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Onboarding Status Guard:
 * Ensures customer accounts have completed onboarding review before moving funds.
 */
export function requireActiveStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'You must be signed in to perform this action',
    });
    return;
  }

  if (req.user.status === UserStatus.PENDING_APPROVAL) {
    res.status(403).json({
      error: 'ONBOARDING_PENDING_APPROVAL',
      message: 'Your account is pending administrator approval before financial transactions are permitted.',
    });
    return;
  }

  if (req.user.status !== UserStatus.ACTIVE) {
    res.status(403).json({
      error: 'ACCOUNT_NOT_ACTIVE',
      message: `Account status is ${req.user.status}. Action not permitted.`,
    });
    return;
  }

  next();
}
