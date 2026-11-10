import { Role, UserStatus, AccountStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../utils/crypto.js';
import { AuditService } from './audit.service.js';

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  // Any client-supplied role or status will be explicitly ignored
  role?: unknown;
  status?: unknown;
}

export interface LoginDTO {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Register a new account holder:
   * Enforces server-side RBAC: role is ALWAYS CUSTOMER, status is ALWAYS PENDING_APPROVAL.
   */
  static async register(dto: RegisterDTO) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const error = new Error('Email address is already registered');
      (error as Record<string, unknown>).statusCode = 409;
      (error as Record<string, unknown>).code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    const passwordHash = await hashPassword(dto.password);

    // Atomic creation: User + Default Account + Audit Log
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          fullName: dto.fullName.trim(),
          passwordHash,
          role: Role.CUSTOMER, // Server-enforced: cannot be overridden by client
          status: UserStatus.PENDING_APPROVAL, // Onboarding workflow: requires admin approval
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      // Generate a unique account number: ACC-INR-<random-6-digits>
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const accountNumber = `ACC-INR-${randomSuffix}`;

      const account = await tx.account.create({
        data: {
          accountNumber,
          userId: user.id,
          balance: BigInt(0), // Initial balance is 0 paise
          currency: 'INR',
          status: AccountStatus.ACTIVE,
        },
      });

      // Record in cryptographic audit trail
      await AuditService.append(tx, {
        actorId: user.id,
        actorRole: Role.CUSTOMER,
        action: 'USER_REGISTER',
        resource: 'User',
        resourceId: user.id,
        status: 'SUCCESS',
        details: { email: user.email, accountNumber: account.accountNumber },
      });

      return {
        user,
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance.toString(),
          currency: account.currency,
          status: account.status,
        },
      };
    });
  }

  /**
   * Authenticate user with Argon2id and create a server-managed session
   */
  static async login(dto: LoginDTO) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Perform a dummy verification to prevent email timing attacks
      await hashPassword('dummy_timing_protection_password');
      const error = new Error('Invalid email or password');
      (error as Record<string, unknown>).statusCode = 401;
      (error as Record<string, unknown>).code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      (error as Record<string, unknown>).statusCode = 401;
      (error as Record<string, unknown>).code = 'INVALID_CREDENTIALS';
      throw error;
    }

    if (user.status === UserStatus.SUSPENDED) {
      const error = new Error('Your account has been suspended. Please contact customer support.');
      (error as Record<string, unknown>).statusCode = 403;
      (error as Record<string, unknown>).code = 'ACCOUNT_SUSPENDED';
      throw error;
    }

    // Generate secure session token (32 bytes = 64 hex characters)
    const rawSessionToken = generateRandomToken(32);
    const tokenHash = hashToken(rawSessionToken);
    const csrfToken = generateRandomToken(32);

    // Session valid for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        csrfToken,
        ipAddress: dto.ipAddress || null,
        userAgent: dto.userAgent || null,
        expiresAt,
      },
    });

    // Record login event in audit log
    await AuditService.append(prisma, {
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN',
      resource: 'Session',
      resourceId: session.id,
      ipAddress: dto.ipAddress || null,
      status: 'SUCCESS',
      details: { email: user.email },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
      rawSessionToken,
      csrfToken,
      expiresAt,
    };
  }

  /**
   * Revoke session on logout
   */
  static async logout(sessionToken: string, userId: string) {
    const tokenHash = hashToken(sessionToken);

    await prisma.session.updateMany({
      where: { tokenHash, userId },
      data: { isRevoked: true },
    });

    await AuditService.append(prisma, {
      actorId: userId,
      action: 'AUTH_LOGOUT',
      resource: 'Session',
      status: 'SUCCESS',
      details: { tokenHashPrefix: tokenHash.substring(0, 8) },
    });
  }

  /**
   * Get current authenticated user profile and active accounts
   */
  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
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
    });

    if (!user) {
      const error = new Error('User not found');
      (error as Record<string, unknown>).statusCode = 404;
      throw error;
    }

    return {
      ...user,
      accounts: user.accounts.map((acc) => ({
        ...acc,
        balance: acc.balance.toString(), // Safely serialize BigInt to string
      })),
    };
  }
}

