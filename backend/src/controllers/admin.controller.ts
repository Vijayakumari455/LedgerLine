import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminService } from '../services/admin.service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { Role, UserStatus } from '../constants/roles.js';

export const listUsersSchema = z.object({
  query: z.object({
    role: z.nativeEnum(Role).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

export const userActionSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    reason: z.string().max(255).optional(),
  }).optional(),
});

export const accountActionSchema = z.object({
  params: z.object({
    accountId: z.string().uuid('Invalid account ID format'),
  }),
  body: z.object({
    reason: z.string().max(255).optional(),
  }).optional(),
});

export class AdminController {
  static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminService.listUsers({
        role: req.query.role as Role | undefined,
        status: req.query.status as UserStatus | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string | undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async approveUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const targetUserId = req.params.userId;

      const user = await AdminService.approveUser(adminId, targetUserId);

      res.status(200).json({
        message: `Customer ${user.email} onboarding approved successfully`,
        user,
      });
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error.statusCode) {
        res.status(error.statusCode as number).json({
          error: 'ACTION_FAILED',
          message: error.message,
        });
        return;
      }
      next(err);
    }
  }

  static async rejectUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const targetUserId = req.params.userId;
      const reason = req.body?.reason;

      const user = await AdminService.rejectUser(adminId, targetUserId, reason);

      res.status(200).json({
        message: `User ${user.email} status updated to SUSPENDED. Active sessions revoked.`,
        user,
      });
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error.statusCode) {
        res.status(error.statusCode as number).json({
          error: 'ACTION_FAILED',
          message: error.message,
        });
        return;
      }
      next(err);
    }
  }

  static async freezeAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const accountId = req.params.accountId;
      const reason = req.body?.reason;

      const account = await AdminService.freezeAccount(adminId, accountId, reason);

      res.status(200).json({
        message: `Account ${account.accountNumber} has been frozen`,
        account,
      });
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error.statusCode) {
        res.status(error.statusCode as number).json({
          error: 'ACTION_FAILED',
          message: error.message,
        });
        return;
      }
      next(err);
    }
  }

  static async unfreezeAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const accountId = req.params.accountId;

      const account = await AdminService.unfreezeAccount(adminId, accountId);

      res.status(200).json({
        message: `Account ${account.accountNumber} has been reactivated`,
        account,
      });
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error.statusCode) {
        res.status(error.statusCode as number).json({
          error: 'ACTION_FAILED',
          message: error.message,
        });
        return;
      }
      next(err);
    }
  }
}

