import { Role, UserStatus, AccountStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AuditService } from './audit.service.js';
import { AppError } from '../utils/errors.js';

export interface ListUsersParams {
  role?: Role;
  status?: UserStatus;
  page?: number;
  limit?: number;
  search?: string;
}

export class AdminService {
  /**
   * List users with optional role/status filters and pagination
   */
  static async listUsers(params: ListUsersParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.role) where.role = params.role;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { fullName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          accounts: {
            select: {
              id: true,
              accountNumber: true,
              balance: true,
              currency: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        accounts: u.accounts.map((acc) => ({
          ...acc,
          balance: acc.balance.toString(),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve a customer onboarding request (PENDING_APPROVAL -> ACTIVE)
   */
  static async approveUser(adminId: string, targetUserId: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }

    if (targetUser.status === UserStatus.ACTIVE) {
      throw new AppError('User is already approved and active', 400);
    }

    return prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { status: UserStatus.ACTIVE },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      });

      await AuditService.append(tx, {
        actorId: adminId,
        actorRole: Role.ADMIN,
        action: 'USER_APPROVE',
        resource: 'User',
        resourceId: targetUserId,
        status: 'SUCCESS',
        details: { previousStatus: targetUser.status, newStatus: UserStatus.ACTIVE },
      });

      return updatedUser;
    });
  }

  /**
   * Reject customer onboarding or suspend an active account
   */
  static async rejectUser(adminId: string, targetUserId: string, reason?: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }

    // Admins cannot suspend themselves
    if (adminId === targetUserId) {
      throw new AppError('Administrators cannot suspend their own account', 400);
    }

    return prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { status: UserStatus.SUSPENDED },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      });

      // Immediately invalidate all active sessions for the suspended user
      await tx.session.updateMany({
        where: { userId: targetUserId },
        data: { isRevoked: true },
      });

      await AuditService.append(tx, {
        actorId: adminId,
        actorRole: Role.ADMIN,
        action: 'USER_REJECT',
        resource: 'User',
        resourceId: targetUserId,
        status: 'SUCCESS',
        details: { reason: reason || 'Rejected/Suspended by administrator' },
      });

      return updatedUser;
    });
  }

  /**
   * Emergency freeze on a financial account
   */
  static async freezeAccount(adminId: string, accountId: string, reason?: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id: accountId },
        data: { status: AccountStatus.FROZEN },
      });

      await AuditService.append(tx, {
        actorId: adminId,
        actorRole: Role.ADMIN,
        action: 'ACCOUNT_FREEZE',
        resource: 'Account',
        resourceId: accountId,
        status: 'SUCCESS',
        details: { reason: reason || 'Emergency security freeze' },
      });

      return {
        ...updated,
        balance: updated.balance.toString(),
      };
    });
  }

  /**
   * Unfreeze an account
   */
  static async unfreezeAccount(adminId: string, accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id: accountId },
        data: { status: AccountStatus.ACTIVE },
      });

      await AuditService.append(tx, {
        actorId: adminId,
        actorRole: Role.ADMIN,
        action: 'ACCOUNT_UNFREEZE',
        resource: 'Account',
        resourceId: accountId,
        status: 'SUCCESS',
      });

      return {
        ...updated,
        balance: updated.balance.toString(),
      };
    });
  }
}

