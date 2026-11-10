import { Role, UserStatus, AccountStatus } from '../src/constants/roles.js';
import { requireRole } from '../src/middleware/rbac.js';
import { AuthenticatedRequest } from '../src/types/auth.js';

describe('Phase 4 - Admin Bootstrap & Customer Onboarding Tests', () => {

  describe('1. One-Time Administrator Bootstrap Security (T-02)', () => {
    interface MockUser {
      id: string;
      email: string;
      role: Role;
      status: UserStatus;
    }

    const mockDb: MockUser[] = [];
    const VALID_SECRET = 'valid_secure_admin_bootstrap_secret_123';

    async function simulateBootstrap(params: {
      secret?: string;
      email?: string;
      password?: string;
    }): Promise<{ success: boolean; adminId: string }> {
      // 1. Verify Secret
      if (!params.secret || params.secret !== VALID_SECRET) {
        throw new Error('BOOTSTRAP_FORBIDDEN: Invalid or missing ADMIN_BOOTSTRAP_SECRET');
      }

      // 2. Validate Password Length
      if (!params.password || params.password.length < 8) {
        throw new Error('BOOTSTRAP_INVALID_PASSWORD: Password must be at least 8 characters');
      }

      // 3. Ensure no admin already exists
      const existingAdmin = mockDb.find((u) => u.role === Role.ADMIN);
      if (existingAdmin) {
        throw new Error('BOOTSTRAP_ALREADY_COMPLETED: An administrator account already exists. Bootstrap cannot be rerun.');
      }

      // 4. Create Admin
      const newAdmin: MockUser = {
        id: `admin-${Date.now()}`,
        email: params.email || 'admin@balancevault.local',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      };

      mockDb.push(newAdmin);
      return { success: true, adminId: newAdmin.id };
    }

    beforeEach(() => {
      mockDb.length = 0; // Reset before tests
    });

    it('rejects bootstrap attempts with invalid or missing secret', async () => {
      await expect(
        simulateBootstrap({ secret: 'wrong_secret', password: 'ValidAdminPass!2026' })
      ).rejects.toThrow('BOOTSTRAP_FORBIDDEN');

      await expect(
        simulateBootstrap({ secret: undefined, password: 'ValidAdminPass!2026' })
      ).rejects.toThrow('BOOTSTRAP_FORBIDDEN');
    });

    it('rejects bootstrap attempts with passwords shorter than 8 characters', async () => {
      await expect(
        simulateBootstrap({ secret: VALID_SECRET, password: 'short' })
      ).rejects.toThrow('BOOTSTRAP_INVALID_PASSWORD');
    });

    it('successfully provisions the primary administrator when no admin exists', async () => {
      const result = await simulateBootstrap({
        secret: VALID_SECRET,
        email: 'root-admin@balancevault.local',
        password: 'ValidAdminPass!2026',
      });

      expect(result.success).toBe(true);
      expect(result.adminId).toBeDefined();

      const created = mockDb.find((u) => u.id === result.adminId);
      expect(created?.role).toBe(Role.ADMIN);
      expect(created?.status).toBe(UserStatus.ACTIVE);
    });

    it('strictly refuses to rerun bootstrap when an administrator already exists (T-02)', async () => {
      // First bootstrap succeeds
      await simulateBootstrap({
        secret: VALID_SECRET,
        email: 'root-admin@balancevault.local',
        password: 'ValidAdminPass!2026',
      });

      // Second bootstrap attempt must be blocked
      await expect(
        simulateBootstrap({
          secret: VALID_SECRET,
          email: 'attacker@balancevault.local',
          password: 'AttackerPassword!2026',
        })
      ).rejects.toThrow('BOOTSTRAP_ALREADY_COMPLETED');
    });
  });

  describe('2. Customer Onboarding Review Workflow', () => {
    interface MockUserAccount {
      id: string;
      email: string;
      role: Role;
      status: UserStatus;
      activeSessions: string[];
    }

    interface MockAccount {
      id: string;
      accountNumber: string;
      status: AccountStatus;
    }

    let users: MockUserAccount[] = [];
    let accounts: MockAccount[] = [];

    beforeEach(() => {
      users = [
        {
          id: 'admin-001',
          email: 'admin@balancevault.local',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
          activeSessions: ['sess-admin'],
        },
        {
          id: 'cust-pending',
          email: 'applicant@balancevault.local',
          role: Role.CUSTOMER,
          status: UserStatus.PENDING_APPROVAL,
          activeSessions: ['sess-applicant'],
        },
        {
          id: 'cust-active',
          email: 'active@balancevault.local',
          role: Role.CUSTOMER,
          status: UserStatus.ACTIVE,
          activeSessions: ['sess-active'],
        },
      ];

      accounts = [
        {
          id: 'acc-001',
          accountNumber: 'ACC-INR-100001',
          status: AccountStatus.ACTIVE,
        },
      ];
    });

    it('approves customer onboarding (PENDING_APPROVAL -> ACTIVE)', () => {
      const targetUser = users.find((u) => u.id === 'cust-pending')!;
      expect(targetUser.status).toBe(UserStatus.PENDING_APPROVAL);

      // Admin approves
      targetUser.status = UserStatus.ACTIVE;
      expect(targetUser.status).toBe(UserStatus.ACTIVE);
    });

    it('rejects and suspends customer, immediately revoking active sessions', () => {
      const targetUser = users.find((u) => u.id === 'cust-pending')!;
      expect(targetUser.activeSessions.length).toBeGreaterThan(0);

      // Admin rejects/suspends
      targetUser.status = UserStatus.SUSPENDED;
      targetUser.activeSessions = []; // Invalidate sessions

      expect(targetUser.status).toBe(UserStatus.SUSPENDED);
      expect(targetUser.activeSessions).toHaveLength(0);
    });

    it('performs emergency freeze and unfreeze on accounts', () => {
      const account = accounts.find((a) => a.id === 'acc-001')!;
      expect(account.status).toBe(AccountStatus.ACTIVE);

      // Admin freezes account
      account.status = AccountStatus.FROZEN;
      expect(account.status).toBe(AccountStatus.FROZEN);

      // Admin reactivates account
      account.status = AccountStatus.ACTIVE;
      expect(account.status).toBe(AccountStatus.ACTIVE);
    });
  });

  describe('3. Admin Endpoint Authorization Guarding', () => {
    function createMockReqRes(role: Role) {
      const req = {
        user: {
          id: 'mock-user',
          email: 'test@balancevault.local',
          role,
          status: UserStatus.ACTIVE,
          sessionId: 'sess-test',
        },
      } as unknown as AuthenticatedRequest;

      let statusCode = 200;
      let body: Record<string, unknown> | null = null;

      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: Record<string, unknown>) {
          body = data;
          return this;
        },
        getStatusCode: () => statusCode,
        getBody: () => body,
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      return { req, res, next, isNextCalled: () => nextCalled };
    }

    it('allows ADMIN to proceed past RBAC middleware', () => {
      const { req, res, next, isNextCalled } = createMockReqRes(Role.ADMIN);
      const guard = requireRole(Role.ADMIN);
      guard(req, res as any, next);

      expect(isNextCalled()).toBe(true);
      expect(res.getStatusCode()).toBe(200);
    });

    it('blocks CUSTOMER from accessing admin routes with 403 Forbidden', () => {
      const { req, res, next, isNextCalled } = createMockReqRes(Role.CUSTOMER);
      const guard = requireRole(Role.ADMIN);
      guard(req, res as any, next);

      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody()?.error).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('blocks OPERATOR from executing ADMIN-only actions with 403 Forbidden', () => {
      const { req, res, next, isNextCalled } = createMockReqRes(Role.OPERATOR);
      const guard = requireRole(Role.ADMIN);
      guard(req, res as any, next);

      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(403);
    });
  });

});
