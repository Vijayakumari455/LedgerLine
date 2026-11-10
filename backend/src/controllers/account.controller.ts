import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { AccountStatus } from '../constants/roles.js';
import { AuditService } from '../services/audit.service.js';

export class AccountController {
  /**
   * List all accounts owned by the authenticated customer
   */
  static async listMyAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const accounts = await prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json({
        accounts: accounts.map((acc) => ({
          id: acc.id,
          accountNumber: acc.accountNumber,
          balance: acc.balance.toString(),
          currency: acc.currency,
          status: acc.status,
          createdAt: acc.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get specific account details by ID
   * Enforces IDOR defense: returns uniform 404 if account does not belong to caller
   */
  static async getAccountById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const accountId = req.params.accountId;

      const account = await prisma.account.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        res.status(404).json({
          error: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
        });
        return;
      }

      res.status(200).json({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance.toString(),
          currency: account.currency,
          status: account.status,
          createdAt: account.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new secondary account for the authenticated customer
   */
  static async createAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const accountNumber = `ACC-INR-${randomSuffix}`;

      const account = await prisma.account.create({
        data: {
          accountNumber,
          userId,
          balance: BigInt(0),
          currency: 'INR',
          status: AccountStatus.ACTIVE,
        },
      });

      await AuditService.append(prisma, {
        actorId: userId,
        action: 'ACCOUNT_CREATE',
        resource: 'Account',
        resourceId: account.id,
        status: 'SUCCESS',
        details: { accountNumber: account.accountNumber },
      });

      res.status(201).json({
        message: 'Account created successfully',
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance.toString(),
          currency: account.currency,
          status: account.status,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

