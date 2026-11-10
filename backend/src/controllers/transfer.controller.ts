import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { LedgerService } from '../services/ledger.service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { AppError } from '../utils/errors.js';

export const depositSchema = z.object({
  body: z.object({
    accountId: z.string().uuid('Invalid account ID format'),
    amount: z.coerce.bigint().positive('Deposit amount must be positive integer minor units'),
    description: z.string().max(255).optional(),
  }),
});

export const withdrawSchema = z.object({
  body: z.object({
    accountId: z.string().uuid('Invalid account ID format'),
    amount: z.coerce.bigint().positive('Withdrawal amount must be positive integer minor units'),
    description: z.string().max(255).optional(),
  }),
});

export const transferSchema = z.object({
  body: z.object({
    sourceAccountId: z.string().uuid('Invalid source account ID format'),
    destinationAccountNumber: z.string().min(5, 'Invalid destination account number').max(32),
    amount: z.coerce.bigint().positive('Transfer amount must be positive integer minor units'),
    description: z.string().max(255).optional(),
  }),
});

export const statementSchema = z.object({
  params: z.object({
    accountId: z.string().uuid('Invalid account ID format'),
  }),
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export class TransferController {
  static async deposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LedgerService.deposit({
        userId: req.user!.id,
        accountId: req.body.accountId,
        amount: BigInt(req.body.amount),
        description: req.body.description,
        idempotencyKey: req.idempotencyKey,
      });

      res.status(200).json({
        message: 'Deposit completed successfully',
        ...result,
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.code || 'DEPOSIT_FAILED',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  }

  static async withdraw(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LedgerService.withdraw({
        userId: req.user!.id,
        accountId: req.body.accountId,
        amount: BigInt(req.body.amount),
        description: req.body.description,
        idempotencyKey: req.idempotencyKey,
      });

      res.status(200).json({
        message: 'Withdrawal completed successfully',
        ...result,
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.code || 'WITHDRAWAL_FAILED',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  }

  static async transfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LedgerService.transfer({
        senderUserId: req.user!.id,
        sourceAccountId: req.body.sourceAccountId,
        destinationAccountNumber: req.body.destinationAccountNumber,
        amount: BigInt(req.body.amount),
        description: req.body.description,
        idempotencyKey: req.idempotencyKey,
      });

      res.status(200).json({
        message: 'Transfer executed successfully',
        ...result,
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.code || 'TRANSFER_FAILED',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  }

  static async getStatement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawAccountId = req.params.accountId;
      if (typeof rawAccountId !== 'string' || !rawAccountId.trim()) {
        res.status(400).json({
          error: 'INVALID_PARAMETER',
          message: 'Valid accountId route parameter is required',
        });
        return;
      }

      const accountId = rawAccountId.trim();
      const result = await LedgerService.getStatement({
        userId: req.user!.id,
        accountId,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });

      res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: err.code || 'STATEMENT_FETCH_FAILED',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  }
}

