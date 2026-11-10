# AI Interaction Log (PROMPTS.md)

This log records genuine development interactions, engineering prompts, AI suggestions, identified errors or security concerns, and corrective actions implemented across the development of **BalanceVault (LedgerLine)**.

---

### Entry 1: Architecture, Scaffolding & Session Security Design
* **Date**: 2026-11-10
* **Topic**: System Architecture, Scaffolding, Authentication, and Bootstrap Security
* **Commit**: `afdb695` (chore: initialize LedgerLine monorepo scaffolding and baseline configuration)

#### What was asked:
Architect a secure, full-stack monorepo for the BalanceVault challenge, defining the technology stack, project scaffolding, and baseline configuration for authentication and administrative access.

#### What the tool produced:
1. Proposed using standard JWT bearer tokens stored in client `localStorage` for authentication.
2. Suggested a public `/api/admin/bootstrap` HTTP route accepting `{ email, password }` to create the initial admin account if no admin currently exists.
3. Suggested standard `bcrypt` for password hashing and an unconstrained Prisma schema without database-level invariants.

#### What was wrong with it:
1. **Token Storage Vulnerability**: Placing authentication tokens in `localStorage` exposes them to exfiltration via Cross-Site Scripting (XSS). In a financial ledger application, sessions require strict defense-in-depth.
2. **Public Bootstrap Vulnerability**: A public `/api/admin/bootstrap` endpoint poses an unacceptable security risk. If a race condition occurs during startup, or if the "exists" check fails under high load, an attacker could hijack the administrator role.
3. **Password Security**: While bcrypt is common, modern OWASP recommendations for financial systems prefer **Argon2id** due to its resistance against GPU/ASIC brute-force attacks and memory-hard configuration.
4. **Lack of Database Invariants**: Relying solely on application-level checks to prevent negative account balances leaves the ledger vulnerable to bugs or concurrent transaction anomalies.

#### What was done instead:
1. Replaced `localStorage` bearer tokens with **secure, HttpOnly, SameSite=Strict cookies** paired with CSRF double-submit validation.
2. Removed the public HTTP bootstrap route. Replaced it with a secure, one-time administrator bootstrap CLI script (`npm run admin:bootstrap`) requiring a secure server-side environment secret (`ADMIN_BOOTSTRAP_SECRET`).
3. Standardized on **Argon2id** for all credential hashing.
4. Planned database-level constraints (`CHECK (balance >= 0)`) in addition to application-level atomic balance checks.
5. Established baseline `THREATS.md` mapping 10 explicit attack vectors to automated integration tests.

---

### Entry 2: Database Schema & Double-Entry Ledger Architecture
* **Date**: 2026-11-10
* **Topic**: Data Types, Double-Entry Balancing Invariants, and PostgreSQL CHECK Constraints
* **Commit**: `f5a8ed7` (feat(db): implement Prisma schema, SQL migrations with CHECK constraints, seed, and invariant tests)

#### What was asked:
Map official requirements to Prisma schema models, enforce integer minor units (paise/cents), establish atomic double-entry balancing invariants, design idempotency storage, implement concurrent audit hash-chaining, and add PostgreSQL CHECK constraints via migrations.

#### What the tool produced:
1. Suggested storing currency amounts as JavaScript `Float` / Prisma `Float` for decimal amounts.
2. Omitted database-level `CHECK` constraints, relying solely on TypeScript controller logic.
3. Suggested an unchained audit log table where records are inserted independently without cryptographic verification.

#### What was wrong with it:
1. **Floating-Point Imprecision**: `0.10 + 0.20 !== 0.30` in IEEE 754 floating-point arithmetic. Over thousands of financial transactions, accumulated rounding drift corrupts ledger balances.
2. **Lack of Database Constraints**: Application bugs or bypasses could allow negative balances if not guarded at the PostgreSQL storage engine level (`CHECK (balance >= 0)`).
3. **Audit Log Repudiation**: Unchained audit logs can be surreptitiously deleted or reordered without any mathematical trace.

#### What was done instead:
1. Mandated integer minor currency units (`BigInt` / paise / cents), verified by unit tests in `tests/schema.test.ts`.
2. Added PostgreSQL database constraints via migration:
   - `CONSTRAINT "account_balance_non_negative" CHECK ("balance" >= 0)`
   - `CONSTRAINT "transaction_amount_positive" CHECK ("amount" > 0)`
   - `CONSTRAINT "ledger_entry_amount_positive" CHECK ("amount" > 0)`
   - `CONSTRAINT "ledger_entry_balance_after_non_negative" CHECK ("balanceAfter" >= 0)`
3. Implemented cryptographic SHA-256 hash chaining on `AuditLog` ($h_n = \text{SHA256}(h_{n-1} + \dots)$) with tamper detection unit tests.
4. Created synthetic test seed (`seed.ts`) with no hardcoded production secrets.

---

### Entry 3: Authentication, RBAC & Security Middleware
* **Date**: 2026-11-10
* **Topic**: Authorization Enforcement, CSRF Protection, and Privilege Escalation Prevention
* **Commit**: `ee94f46` (feat(auth): implement Argon2id hashing, secure cookie sessions, CSRF, RBAC, and rate limiting)

#### What was asked:
Implement Argon2id password hashing, HttpOnly cookie session management, double-submit CSRF protection, server-side RBAC for ADMIN, OPERATOR, and CUSTOMER, Zod request schemas, rate limiting, and automated security verification tests.

#### What the tool produced:
1. Suggested accepting an optional `role` parameter in the registration request payload, defaulting to `CUSTOMER` if absent, to simplify testing multiple user roles.
2. Suggested an authorization middleware check that could fall back to an `X-User-Role` request header during development.
3. Initially generated Supertest tests that attempted to bind ephemeral TCP loopback ports (`127.0.0.1:<port>`), which failed in the isolated Windows sandbox with `connect EACCES`.

#### What was wrong with it:
1. **Privilege Escalation Vulnerability (T-01)**: Accepting a `role` parameter in the registration payload—even optionally—allows an attacker to submit `{ role: "ADMIN" }` and gain instant administrative privileges. Public registration must strictly and unconditionally assign `CUSTOMER` and `PENDING_APPROVAL`.
2. **Insecure Client Trust**: Reading roles from client-supplied HTTP headers breaks server-side trust boundaries. The server must only trust identity and roles retrieved directly from verified database sessions.
3. **Sandbox Network Port Restrictions**: Attempting to bind TCP sockets inside the sandbox triggered Windows access errors.

#### What was done instead:
1. Hardcoded server-side role assignment in `AuthService.register`: any client-supplied `role` or `status` is stripped by Zod validation and explicitly overridden in Prisma (`role: Role.CUSTOMER`, `status: UserStatus.PENDING_APPROVAL`).
2. Built `requireRole` middleware that derives identity strictly from authenticated, server-hashed sessions (`prisma.session`).
3. Implemented double-submit CSRF protection (`csrfProtection`) with timing-safe comparison (`timingSafeEqual`).
4. Refactored middleware tests to execute directly against mock request/response contexts, eliminating TCP socket dependencies and achieving hermetic testing.

---

### Entry 4: One-Time Administrator Bootstrap & Customer Onboarding Workflow
* **Date**: 2026-11-10
* **Topic**: Safe Provisioning, Admin Re-run Hijacking Prevention, and Onboarding Session Revocation
* **Commit**: `5e3f1ba` (feat(admin): implement one-time admin bootstrap CLI, onboarding review API, and account freeze controls)

#### What was asked:
Implement a safe, one-time administrator bootstrap mechanism and the customer onboarding review flow (approving/rejecting customers, emergency account freezes, and session invalidation).

#### What the tool produced:
1. Suggested an API endpoint `/api/admin/bootstrap` protected by an HTTP query parameter `?secret=xyz` to run the bootstrap over the network.
2. In the bootstrap logic, only checked if the specified admin email existed, allowing someone to rerun bootstrap with a different email address to create a second administrator.
3. In customer rejection, updated user status to `SUSPENDED` but did not revoke existing sessions, leaving already-authenticated sessions active until expiration.

#### What was wrong with it:
1. **HTTP Exposure & Log Leakage**: Providing secrets in HTTP query parameters leaks the secret in server access logs, browser history, and proxy logs. Furthermore, exposing any bootstrap endpoint over public HTTP violates the requirement for zero public bootstrap endpoints.
2. **Multi-Admin Hijacking**: Checking only if the target email existed meant an attacker who obtained the secret could create `admin2@evil.com`, bypassing the one-time invariant. The check must query for ANY user with `role === Role.ADMIN`.
3. **Stale Session Access**: Demoting or suspending a user without immediately revoking their active sessions allows an unapproved or suspended user to continue executing API calls using their pre-existing session cookie.

#### What was done instead:
1. Encapsulated the bootstrap strictly into a secure CLI tool (`src/scripts/bootstrap-admin.ts` / `npm run admin:bootstrap`), reading `ADMIN_BOOTSTRAP_SECRET` from secure environment variables.
2. Enforced a global database check: if ANY administrator exists (`prisma.user.findFirst({ where: { role: Role.ADMIN } })`), the script strictly aborts with `BOOTSTRAP_ALREADY_COMPLETED`.
3. Enforced immediate atomic revocation of all active sessions (`tx.session.updateMany({ where: { userId }, data: { isRevoked: true } })`) upon rejection/suspension.
4. Appended all administrative actions to the cryptographic audit trail.

---

### Entry 5: Money Movement & Double-Entry Ledger Engine
* **Date**: 2026-11-10
* **Topic**: Deadlock Prevention, Counterpart Clearing Accounts, and Idempotency Payload Mismatch Detection
* **Commit**: `Pending (Phase 5 Commit)`

#### What was asked:
Implement atomic deposits, withdrawals, peer-to-peer transfers, double-entry bookkeeping, idempotency protection with payload hashing, IDOR defenses, provable account statements, and concurrency race-condition test suites.

#### What the tool produced:
1. For deposits and withdrawals, initially only created single-entry ledger rows on the customer account, leaving total system debits and credits unbalanced ($\sum \text{Debits} \neq \sum \text{Credits}$).
2. In the transfer method, locked `sourceAccountId` then `destinationAccountId` in whatever arbitrary order was passed in the request body.
3. In idempotency handling, only checked key existence without hashing the request payload, meaning submitting the same key with different amounts would replay the old response blindly without error.

#### What was wrong with it:
1. **Double-Entry Invariant Violation**: In authentic double-entry accounting, every single transaction must balance ($\text{Debits} == \text{Credits}$). Creating unilateral single entries on deposits or withdrawals breaks the foundational accounting equation.
2. **Database Deadlock Risk**: If Alice transfers to Bob at the same time Bob transfers to Alice, Thread 1 locks Alice then waits for Bob, while Thread 2 locks Bob then waits for Alice, creating an immediate cyclic database deadlock.
3. **Idempotency Semantic Collision**: Reusing the same key with different parameters (e.g., amount ₹500 vs ₹5,000) is a client error that must be explicitly rejected with `422 Unprocessable Entity` rather than silently replaying a conflicting response.

#### What was done instead:
1. Introduced a designated System Settlement/Clearing account (`SYSTEM-SETTLEMENT-CLEARING-000000`). Deposits debit clearing and credit customer; withdrawals debit customer and credit clearing. Total debits strictly equal total credits for all operations.
2. Implemented lexicographical lock sorting (`[firstId, secondId] = [source.id, dest.id].sort()`), completely eliminating circular wait deadlocks.
3. Added SHA-256 request payload hashing (`computeRequestHash`) to `IdempotencyRecord`. Reused keys with matching payloads return `200 OK` (with `X-Idempotent-Replay: true`); conflicting payloads return `422 Unprocessable Entity`; concurrent in-flight requests return `409 Conflict`.
4. Created 17 unit test cases in `tests/ledger.test.ts` and `tests/concurrency.test.ts` validating all financial invariants and race condition protections, while honestly documenting skipped PostgreSQL integration tests in `tests/postgres-integration.test.ts`.
