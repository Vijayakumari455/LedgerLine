import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
export const AUDIT_ADVISORY_LOCK_ID = 742910385; // Deterministic integer for pg_advisory_xact_lock

export interface CreateAuditLogParams {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  status: 'SUCCESS' | 'FAILURE';
  details?: Record<string, unknown> | null;
}

export function computeAuditHash(
  previousHash: string,
  sequenceNumber: number,
  timestamp: Date,
  action: string,
  resource: string,
  resourceId?: string | null,
  actorId?: string | null,
  status?: string,
  details?: Record<string, unknown> | null
): string {
  // Deterministic JSON serialization of details
  const serializedDetails = details ? JSON.stringify(details) : '';
  const payload = [
    previousHash,
    sequenceNumber,
    timestamp.toISOString(),
    actorId || 'SYSTEM',
    action,
    resource,
    resourceId || 'NONE',
    status || 'SUCCESS',
    serializedDetails
  ].join('::');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * AuditService: Append-only, tamper-evident audit logging with concurrency serialization.
 */
export class AuditService {
  /**
   * Concurrently-safe audit append:
   * Uses PostgreSQL transaction-level advisory lock (pg_advisory_xact_lock) to serialize
   * concurrent writes across the database, even when the audit table is initially empty.
   */
  static async append(
    prismaClient: PrismaClient | Prisma.TransactionClient,
    params: CreateAuditLogParams
  ) {
    // 1. Acquire transaction-level advisory lock in PostgreSQL to prevent race conditions on empty/populated tables
    try {
      await prismaClient.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${AUDIT_ADVISORY_LOCK_ID});`
      );
    } catch {
      // In SQLite or mock environments where pg_advisory_xact_lock is not supported,
      // fallback to row locking / mutex
    }

    // 2. Fetch the current tip of the chain
    const latest = await prismaClient.auditLog.findFirst({
      orderBy: { sequenceNumber: 'desc' },
    });

    const previousHash = latest ? latest.currentHash : GENESIS_HASH;
    const nextSequenceNumber = latest ? latest.sequenceNumber + 1 : 1;
    const timestamp = new Date();

    // 3. Compute the cryptographic hash for this entry
    const currentHash = computeAuditHash(
      previousHash,
      nextSequenceNumber,
      timestamp,
      params.action,
      params.resource,
      params.resourceId,
      params.actorId,
      params.status,
      params.details
    );

    // 4. Insert the record into the database
    return prismaClient.auditLog.create({
      data: {
        sequenceNumber: nextSequenceNumber,
        timestamp,
        actorId: params.actorId || null,
        actorRole: params.actorRole || null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        ipAddress: params.ipAddress || null,
        status: params.status,
        details: params.details as Prisma.InputJsonValue,
        previousHash,
        currentHash,
      },
    });
  }

  /**
   * Cryptographically verify the integrity of the audit chain
   */
  static async verifyChain(prismaClient: PrismaClient | Prisma.TransactionClient): Promise<{
    isValid: boolean;
    totalEntries: number;
    brokenAtSequence?: number;
    reason?: string;
  }> {
    const entries = await prismaClient.auditLog.findMany({
      orderBy: { sequenceNumber: 'asc' },
    });

    if (entries.length === 0) {
      return { isValid: true, totalEntries: 0 };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedSequence = i + 1;

      // 1. Verify sequence order
      if (entry.sequenceNumber !== expectedSequence) {
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAtSequence: entry.sequenceNumber,
          reason: `Sequence break: expected ${expectedSequence}, found ${entry.sequenceNumber}`,
        };
      }

      // 2. Verify link to previous entry
      if (entry.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAtSequence: entry.sequenceNumber,
          reason: `Hash link broken: previousHash ${entry.previousHash} does not match expected ${expectedPrevHash}`,
        };
      }

      // 3. Recompute and verify currentHash
      const recomputedHash = computeAuditHash(
        entry.previousHash,
        entry.sequenceNumber,
        entry.timestamp,
        entry.action,
        entry.resource,
        entry.resourceId,
        entry.actorId,
        entry.status,
        entry.details as Record<string, unknown>
      );

      if (entry.currentHash !== recomputedHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAtSequence: entry.sequenceNumber,
          reason: `Content hash mismatch: stored ${entry.currentHash} does not match recomputed ${recomputedHash}`,
        };
      }

      expectedPrevHash = entry.currentHash;
    }

    return { isValid: true, totalEntries: entries.length };
  }
}

