# AI Interaction Log (PROMPTS.md)

This log records genuine development interactions, engineering prompts, AI suggestions, identified errors or security concerns, and corrective actions implemented across the development of **BalanceVault (LedgerLine)**.

---

### Entry 1: Architecture, Scaffolding & Session Security Design
* **Date**: 2026-11-10
* **Topic**: System Architecture, Scaffolding, Authentication, and Bootstrap Security
* **Commit**: `91cccb2` (chore: initialize LedgerLine monorepo scaffolding and baseline configuration)

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
