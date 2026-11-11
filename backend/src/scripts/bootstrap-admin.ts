import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, Role, UserStatus } from '@prisma/client';
import { hashPassword } from '../utils/crypto.js';
import { AuditService } from '../services/audit.service.js';

const prisma = new PrismaClient();

/**
 * Secure One-Time Administrator Bootstrap CLI Script
 *
 * Rules:
 * 1. Requires valid ADMIN_BOOTSTRAP_SECRET environment variable.
 * 2. Checks if an administrator account already exists in the database.
 * 3. If an admin exists, strictly aborts to prevent privilege hijacking.
 * 4. Creates primary administrator and records the event in the cryptographic audit trail.
 */
export async function bootstrapAdmin(params?: {
  secret?: string;
  email?: string;
  fullName?: string;
  password?: string;
}): Promise<{ success: boolean; message: string; adminId?: string }> {
  const secret = params?.secret || process.env.ADMIN_BOOTSTRAP_SECRET;
  const email = (params?.email || process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@ledgerline.local').toLowerCase().trim();
  const fullName = params?.fullName || process.env.ADMIN_BOOTSTRAP_NAME || 'Primary System Administrator';
  const password = params?.password || process.env.ADMIN_BOOTSTRAP_PASSWORD;

  // 1. Verify Bootstrap Secret
  if (!secret || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    throw new Error('BOOTSTRAP_FORBIDDEN: Invalid or missing ADMIN_BOOTSTRAP_SECRET');
  }

  if (!password || password.length < 8) {
    throw new Error('BOOTSTRAP_INVALID_PASSWORD: Administrator password must be at least 8 characters long');
  }

  // 2. Check if an administrator already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    throw new Error('BOOTSTRAP_ALREADY_COMPLETED: An administrator account already exists. For security, bootstrap cannot be rerun.');
  }

  // 3. Hash password using Argon2id
  const passwordHash = await hashPassword(password);

  // 4. Create primary administrator in an atomic transaction
  return prisma.$transaction(async (tx) => {
    const admin = await tx.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    // 5. Append bootstrap event to cryptographic audit trail
    await AuditService.append(tx, {
      actorId: admin.id,
      actorRole: Role.ADMIN,
      action: 'SYSTEM_ADMIN_BOOTSTRAP',
      resource: 'User',
      resourceId: admin.id,
      status: 'SUCCESS',
      details: { email: admin.email, bootstrapType: 'CLI_ONE_TIME' },
    });

    return {
      success: true,
      message: `Administrator ${admin.email} provisioned successfully via one-time bootstrap.`,
      adminId: admin.id,
    };
  });
}

// Allow direct CLI execution: tsx src/scripts/bootstrap-admin.ts
if (process.argv[1]?.includes('bootstrap-admin')) {
  bootstrapAdmin()
    .then((res) => {
      console.log(`[Bootstrap Success] ${res.message}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Bootstrap Error] ${(err as Error).message}`);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

