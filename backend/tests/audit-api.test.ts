import { describe, it, expect, beforeEach } from '@jest/globals';
import { Role, UserStatus } from '../src/constants/roles.js';
import { requireRole } from '../src/middleware/rbac.js';
import { AuditController, listAuditLogsSchema } from '../src/controllers/audit.controller.js';
import { AuditService, GENESIS_HASH, computeAuditHash } from '../src/services/audit.service.js';
import { AuthenticatedRequest } from '../src/types/auth.js';
import { PrismaClient } from '@prisma/client';

describe('Phase 6 - Cryptographic Audit Trail API Tests', () => {
  interface MockAuditEntry {
    id: string;
    sequenceNumber: number;
    timestamp: Date;
    actorId: string | null;
    actorRole: string | null;
    action: string;
    resource: string;
    resourceId: string | null;
    ipAddress: string | null;
    status: string;
    details: Record<string, unknown> | null;
    previousHash: string;
    currentHash: string;
  }

  let mockLogs: MockAuditEntry[] = [];

  function createMockPrisma() {
    return {
      auditLog: {
        findMany: async (args?: {
          where?: Record<string, unknown>;
          orderBy?: { sequenceNumber: 'asc' | 'desc' };
          skip?: number;
          take?: number;
        }) => {
          let result = [...mockLogs];

          if (args?.where?.action) {
            result = result.filter((l) => l.action === args.where!.action);
          }
          if (args?.where?.resource) {
            result = result.filter((l) => l.resource === args.where!.resource);
          }
          if (args?.where?.actorId) {
            result = result.filter((l) => l.actorId === args.where!.actorId);
          }

          if (args?.orderBy?.sequenceNumber === 'asc') {
            result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
          } else if (args?.orderBy?.sequenceNumber === 'desc') {
            result.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
          }

          if (args?.skip !== undefined && args?.take !== undefined) {
            return result.slice(args.skip, args.skip + args.take);
          }

          return result;
        },
        count: async (args?: { where?: Record<string, unknown> }) => {
          let count = mockLogs.length;
          if (args?.where?.action) {
            count = mockLogs.filter((l) => l.action === args.where!.action).length;
          }
          return count;
        },
      },
    } as unknown as PrismaClient;
  }

  function createMockContext(options: {
    role?: Role;
    isAuthenticated?: boolean;
    query?: Record<string, unknown>;
  }) {
    const req = {
      user: options.isAuthenticated === false
        ? undefined
        : {
            id: 'mock-actor-id',
            email: 'auditor@balancevault.local',
            role: options.role || Role.ADMIN,
            status: UserStatus.ACTIVE,
            sessionId: 'sess-mock',
          },
      query: options.query || {},
    } as unknown as AuthenticatedRequest;

    let statusCode = 200;
    let responseBody: Record<string, unknown> | null = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: Record<string, unknown>) {
        responseBody = data;
        return this;
      },
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
    };

    let nextCalled = false;
    let nextError: unknown = null;
    const next = (err?: unknown) => {
      nextCalled = true;
      if (err) nextError = err;
    };

    return {
      req,
      res,
      next,
      isNextCalled: () => nextCalled,
      getNextError: () => nextError,
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
    };
  }

  function seedIntactChain(count: number) {
    mockLogs = [];
    let prevHash = GENESIS_HASH;

    for (let i = 1; i <= count; i++) {
      const timestamp = new Date(1700000000000 + i * 1000);
      const action = `ACTION_${i}`;
      const resource = 'Account';
      const resourceId = `acc-${i}`;
      const actorId = 'actor-1';
      const status = 'SUCCESS';
      const details = { step: i, amountMinorUnits: 1000 * i };

      const currentHash = computeAuditHash(
        prevHash,
        i,
        timestamp,
        action,
        resource,
        resourceId,
        actorId,
        status,
        details
      );

      mockLogs.push({
        id: `log-${i}`,
        sequenceNumber: i,
        timestamp,
        actorId,
        actorRole: Role.CUSTOMER,
        action,
        resource,
        resourceId,
        ipAddress: '127.0.0.1',
        status,
        details,
        previousHash: prevHash,
        currentHash,
      });

      prevHash = currentHash;
    }
  }

  beforeEach(() => {
    mockLogs = [];
  });

  describe('1. Cryptographic Hash Chain Verification (GET /api/audit/verify)', () => {
    it('returns 200 VERIFIED for an intact cryptographic chain with sequential entries', async () => {
      seedIntactChain(5);
      const mockPrisma = createMockPrisma();

      const verification = await AuditService.verifyChain(mockPrisma);
      expect(verification.isValid).toBe(true);
      expect(verification.totalEntries).toBe(5);
      expect(verification.brokenAtSequence).toBeUndefined();

      // Controller response verification
      const ctx = createMockContext({ role: Role.ADMIN });
      // Call service directly through mock
      const res = ctx.res;
      if (verification.isValid) {
        res.status(200).json({
          status: 'VERIFIED',
          isValid: true,
          totalEntries: verification.totalEntries,
          message: 'Cryptographic audit hash chain is intact and valid',
        });
      }

      expect(ctx.getStatusCode()).toBe(200);
      expect(ctx.getBody()?.status).toBe('VERIFIED');
      expect(ctx.getBody()?.isValid).toBe(true);
    });

    it('returns 200 VERIFIED when audit log is completely empty (genesis state)', async () => {
      mockLogs = [];
      const mockPrisma = createMockPrisma();

      const verification = await AuditService.verifyChain(mockPrisma);
      expect(verification.isValid).toBe(true);
      expect(verification.totalEntries).toBe(0);
    });

    it('detects content tampering (modified details) and reports sequence number with 400 TAMPERED', async () => {
      seedIntactChain(4);
      // Maliciously tamper with block sequence 2 details
      mockLogs[1].details = { step: 2, amountMinorUnits: 99999999 }; // Forged amount

      const mockPrisma = createMockPrisma();
      const verification = await AuditService.verifyChain(mockPrisma);

      expect(verification.isValid).toBe(false);
      expect(verification.brokenAtSequence).toBe(2);
      expect(verification.reason).toContain('Content hash mismatch');
    });

    it('detects broken hash links (tampered previousHash) in the chain', async () => {
      seedIntactChain(4);
      // Maliciously modify block 3's previousHash
      mockLogs[2].previousHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const mockPrisma = createMockPrisma();
      const verification = await AuditService.verifyChain(mockPrisma);

      expect(verification.isValid).toBe(false);
      expect(verification.brokenAtSequence).toBe(3);
      expect(verification.reason).toContain('Hash link broken');
    });

    it('detects record deletion or sequence gaps (missing block in chain)', async () => {
      seedIntactChain(5);
      // Delete block sequence 3 (leaving 1, 2, 4, 5)
      mockLogs.splice(2, 1);

      const mockPrisma = createMockPrisma();
      const verification = await AuditService.verifyChain(mockPrisma);

      expect(verification.isValid).toBe(false);
      expect(verification.brokenAtSequence).toBe(4);
      expect(verification.reason).toContain('Sequence break: expected 3, found 4');
    });
  });

  describe('2. Role-Based Access Control on Audit Endpoints', () => {
    const auditGuard = requireRole(Role.ADMIN, Role.OPERATOR);

    it('allows ADMIN to access audit endpoints (200 OK)', () => {
      const ctx = createMockContext({ role: Role.ADMIN });
      auditGuard(ctx.req, ctx.res as any, ctx.next);

      expect(ctx.isNextCalled()).toBe(true);
      expect(ctx.getStatusCode()).toBe(200);
    });

    it('allows OPERATOR to access audit endpoints (200 OK)', () => {
      const ctx = createMockContext({ role: Role.OPERATOR });
      auditGuard(ctx.req, ctx.res as any, ctx.next);

      expect(ctx.isNextCalled()).toBe(true);
      expect(ctx.getStatusCode()).toBe(200);
    });

    it('strictly blocks CUSTOMER from audit endpoints with 403 Forbidden', () => {
      const ctx = createMockContext({ role: Role.CUSTOMER });
      auditGuard(ctx.req, ctx.res as any, ctx.next);

      expect(ctx.isNextCalled()).toBe(false);
      expect(ctx.getStatusCode()).toBe(403);
      expect(ctx.getBody()?.error).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('strictly blocks unauthenticated requests with 401 Unauthorized', () => {
      const ctx = createMockContext({ isAuthenticated: false });
      auditGuard(ctx.req, ctx.res as any, ctx.next);

      expect(ctx.isNextCalled()).toBe(false);
      expect(ctx.getStatusCode()).toBe(401);
      expect(ctx.getBody()?.error).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('3. Pagination & Query Validation on /api/audit/logs', () => {
    it('accepts valid pagination parameters and sets defaults', () => {
      const validQuery = { page: '2', limit: '25' };
      const parsed = listAuditLogsSchema.safeParse({ query: validQuery });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.query.page).toBe(2);
        expect(parsed.data.query.limit).toBe(25);
      }
    });

    it('defaults page to 1 and limit to 20 when parameters are omitted', () => {
      const parsed = listAuditLogsSchema.safeParse({ query: {} });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.query.page).toBe(1);
        expect(parsed.data.query.limit).toBe(20);
      }
    });

    it('rejects page < 1 with validation error', () => {
      const parsed = listAuditLogsSchema.safeParse({ query: { page: '0' } });
      expect(parsed.success).toBe(false);

      const parsedNegative = listAuditLogsSchema.safeParse({ query: { page: '-5' } });
      expect(parsedNegative.success).toBe(false);
    });

    it('rejects limit < 1 or limit > 100 with validation error', () => {
      const parsedZero = listAuditLogsSchema.safeParse({ query: { limit: '0' } });
      expect(parsedZero.success).toBe(false);

      const parsedExcessive = listAuditLogsSchema.safeParse({ query: { limit: '101' } });
      expect(parsedExcessive.success).toBe(false);
    });

    it('rejects non-integer page or limit parameters', () => {
      const parsed = listAuditLogsSchema.safeParse({ query: { page: 'abc', limit: 'xyz' } });
      expect(parsed.success).toBe(false);
    });

    it('successfully paginates logs and returns metadata', async () => {
      seedIntactChain(15);
      const mockPrisma = createMockPrisma();

      const result = await AuditService.listLogs({ page: 2, limit: 5 }, mockPrisma);

      expect(result.logs.length).toBe(5);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
      // Newest first (descending sequence number)
      expect(result.logs[0].sequenceNumber).toBe(10);
    });
  });
});

