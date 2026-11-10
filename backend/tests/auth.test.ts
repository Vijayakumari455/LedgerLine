import { hashPassword, verifyPassword, hashToken, timingSafeEqual } from '../src/utils/crypto.js';
import { requireAuth, SESSION_COOKIE_NAME } from '../src/middleware/auth.js';
import { requireRole, requireActiveStatus } from '../src/middleware/rbac.js';
import { csrfProtection, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrf.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { Role, UserStatus } from '../src/constants/roles.js';
import { AuthenticatedRequest } from '../src/types/auth.js';

/**
 * Hermetic Mock Context Helper for Express Middleware Testing
 * Allows thorough, direct testing of middleware logic without opening TCP sockets.
 */
function createMockContext(reqOverrides: Partial<AuthenticatedRequest> = {}) {
  const req = {
    method: 'GET',
    path: '/',
    headers: {},
    cookies: {},
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...reqOverrides,
  } as unknown as AuthenticatedRequest;

  let statusCode = 200;
  let responseData: Record<string, unknown> | null = null;
  const headers: Record<string, string> = {};
  const cookies: Record<string, { value: unknown; options?: Record<string, unknown> }> = {};

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: Record<string, unknown>) {
      responseData = data;
      return this;
    },
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = val;
      return this;
    },
    cookie(name: string, val: unknown, options?: Record<string, unknown>) {
      cookies[name] = { value: val, options };
      return this;
    },
    clearCookie(name: string) {
      delete cookies[name];
      return this;
    },
    getStatusCode: () => statusCode,
    getBody: () => responseData,
    getHeaders: () => headers,
    getCookies: () => cookies,
  };

  let nextCalled = false;
  let nextError: unknown = null;
  const next = (err?: unknown) => {
    nextCalled = true;
    nextError = err;
  };

  return {
    req,
    res,
    next,
    isNextCalled: () => nextCalled,
    getNextError: () => nextError,
  };
}

describe('Phase 3 - Authentication, RBAC & Security Middleware Tests', () => {

  describe('1. Argon2id Password Hashing & Verification', () => {
    it('generates genuine Argon2id hashes with OWASP-recommended parameters', async () => {
      const password = 'StrongPassword!2026';
      const hash = await hashPassword(password);

      // Verify Argon2id identifier and version
      expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);

      // Verify correct password passes
      const isMatch = await verifyPassword(hash, password);
      expect(isMatch).toBe(true);

      // Verify incorrect password fails
      const isWrongMatch = await verifyPassword(hash, 'WrongPassword!2026');
      expect(isWrongMatch).toBe(false);
    });

    it('ensures distinct salts for identical passwords', async () => {
      const password = 'IdenticalPassword!2026';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(hash1, password)).toBe(true);
      expect(await verifyPassword(hash2, password)).toBe(true);
    });

    it('prevents timing attacks using timingSafeEqual', () => {
      expect(timingSafeEqual('exact_match_token', 'exact_match_token')).toBe(true);
      expect(timingSafeEqual('exact_match_token', 'mismatch_diff_len')).toBe(false);
      expect(timingSafeEqual('token_a_12345678', 'token_b_12345678')).toBe(false);
    });
  });

  describe('2. Server-Side RBAC & Privilege Escalation Prevention (T-01)', () => {
    it('permits access when user role matches authorized role', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        user: {
          id: 'user-001',
          email: 'customer@balancevault.local',
          fullName: 'Alice Customer',
          role: Role.CUSTOMER,
          status: UserStatus.ACTIVE,
          sessionId: 'sess-001',
        },
      });

      const middleware = requireRole(Role.CUSTOMER);
      middleware(req, res as any, next);

      expect(isNextCalled()).toBe(true);
      expect(res.getStatusCode()).toBe(200);
    });

    it('blocks CUSTOMER from accessing ADMIN endpoints with 403 Forbidden', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        user: {
          id: 'user-001',
          email: 'customer@balancevault.local',
          fullName: 'Alice Customer',
          role: Role.CUSTOMER,
          status: UserStatus.ACTIVE,
          sessionId: 'sess-001',
        },
      });

      const middleware = requireRole(Role.ADMIN);
      middleware(req, res as any, next);

      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody()?.error).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('permits OPERATOR to access audit-designated endpoints', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        user: {
          id: 'op-001',
          email: 'operator@balancevault.local',
          fullName: 'Bob Operator',
          role: Role.OPERATOR,
          status: UserStatus.ACTIVE,
          sessionId: 'sess-002',
        },
      });

      const middleware = requireRole(Role.ADMIN, Role.OPERATOR);
      middleware(req, res as any, next);

      expect(isNextCalled()).toBe(true);
    });

    it('blocks users in PENDING_APPROVAL from executing financial actions', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        user: {
          id: 'user-unapproved',
          email: 'pending@balancevault.local',
          fullName: 'Pending User',
          role: Role.CUSTOMER,
          status: UserStatus.PENDING_APPROVAL,
          sessionId: 'sess-003',
        },
      });

      requireActiveStatus(req, res as any, next);

      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody()?.error).toBe('ONBOARDING_PENDING_APPROVAL');
    });
  });

  describe('3. CSRF Protection for State-Changing Requests (T-08)', () => {
    it('permits safe GET requests without CSRF header', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        method: 'GET',
        path: '/api/accounts',
      });

      csrfProtection(req, res as any, next);
      expect(isNextCalled()).toBe(true);
    });

    it('blocks state-changing POST requests when CSRF token is missing with 403 Forbidden', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        method: 'POST',
        path: '/api/transfers',
        csrfToken: 'session_csrf_secret_123',
        headers: {}, // No CSRF header provided
      });

      csrfProtection(req, res as any, next);
      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody()?.error).toBe('CSRF_TOKEN_MISSING');
    });

    it('blocks state-changing POST requests when CSRF token mismatches with 403 Forbidden', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        method: 'POST',
        path: '/api/transfers',
        csrfToken: 'session_csrf_secret_123',
        headers: {
          [CSRF_HEADER_NAME]: 'attacker_forged_csrf_token',
        },
      });

      csrfProtection(req, res as any, next);
      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody()?.error).toBe('CSRF_TOKEN_MISMATCH');
    });

    it('permits state-changing POST requests when valid CSRF token is provided', () => {
      const token = 'valid_session_csrf_secret_token_12345';
      const { req, res, next, isNextCalled } = createMockContext({
        method: 'POST',
        path: '/api/transfers',
        csrfToken: token,
        headers: {
          [CSRF_HEADER_NAME]: token,
        },
      });

      csrfProtection(req, res as any, next);
      expect(isNextCalled()).toBe(true);
      expect(res.getStatusCode()).toBe(200);
    });

    it('exempts initial authentication entry points from CSRF check', () => {
      const { req, res, next, isNextCalled } = createMockContext({
        method: 'POST',
        path: '/api/auth/login',
      });

      csrfProtection(req, res as any, next);
      expect(isNextCalled()).toBe(true);
    });
  });

  describe('4. Token Security & Session Invariants', () => {
    it('verifies session tokens are hashed via SHA-256 and never stored in plaintext', () => {
      const rawToken = 'user_session_raw_secret_token_abcdef123456';
      const hashed = hashToken(rawToken);

      // Token hash is 64 hex characters (SHA-256)
      expect(hashed).toHaveLength(64);
      expect(hashed).not.toBe(rawToken);
      expect(hashToken(rawToken)).toBe(hashed);
    });
  });

  describe('5. Rate Limiting Protection (T-06)', () => {
    it('tracks requests and returns 429 when threshold exceeded', async () => {
      const limiter = createRateLimiter({
        windowSeconds: 60,
        maxRequests: 2,
        keyPrefix: 'unit_test_limiter',
        errorMessage: 'Too many requests',
      });

      // Request 1: within limit
      const ctx1 = createMockContext();
      await limiter(ctx1.req, ctx1.res as any, ctx1.next);
      expect(ctx1.isNextCalled()).toBe(true);
      expect(ctx1.res.getStatusCode()).toBe(200);

      // Request 2: within limit
      const ctx2 = createMockContext();
      await limiter(ctx2.req, ctx2.res as any, ctx2.next);
      expect(ctx2.isNextCalled()).toBe(true);
      expect(ctx2.res.getStatusCode()).toBe(200);

      // Request 3: threshold (2) exceeded -> 429 Too Many Requests
      const ctx3 = createMockContext();
      await limiter(ctx3.req, ctx3.res as any, ctx3.next);
      expect(ctx3.isNextCalled()).toBe(false);
      expect(ctx3.res.getStatusCode()).toBe(429);
      expect(ctx3.res.getBody()?.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(ctx3.res.getHeaders()['retry-after']).toBe('60');
    });
  });

  describe('6. Unauthenticated Access Rejection', () => {
    it('rejects requests without session cookie with 401 Unauthorized', async () => {
      const { req, res, next, isNextCalled } = createMockContext({
        cookies: {}, // No session cookie
      });

      await requireAuth(req, res as any, next);

      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(401);
      expect(res.getBody()?.error).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects requests with empty session cookie with 401 Unauthorized', async () => {
      const { req, res, next, isNextCalled } = createMockContext({
        cookies: { [SESSION_COOKIE_NAME]: '' },
      });

      await requireAuth(req, res as any, next);

      expect(isNextCalled()).toBe(false);
      expect(res.getStatusCode()).toBe(401);
      expect(res.getBody()?.error).toBe('AUTHENTICATION_REQUIRED');
    });
  });

});
