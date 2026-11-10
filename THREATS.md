# Threat Model & Security Mitigations (THREATS.md)

This document outlines the threat model for **BalanceVault (LedgerLine)**, mapping attack vectors against architectural mitigations and automated verification test suites in accordance with the STRIDE methodology and OWASP API Security Top 10.

---

## Threat Matrix

| Threat ID | Threat Category (STRIDE) | Attack Vector | Severity | Architectural Mitigation | Automated Test Coverage | Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| **T-01** | Elevation of Privilege | Attacker sends `role: "ADMIN"` or status modification in registration or profile update payload | Critical | Server enforces strict RBAC; registration assigns `CUSTOMER` role with `PENDING_APPROVAL` status unconditionally. Roles are never updated via client payload. | `tests/rbac.test.ts` | Baseline Defined |
| **T-02** | Elevation of Privilege | Public discovery or brute-force of an unrestricted admin creation endpoint | Critical | No public endpoint exists for admin registration. First admin is provisioned via a dedicated, authenticated one-time CLI script requiring `ADMIN_BOOTSTRAP_SECRET`. | `tests/auth.test.ts` | Baseline Defined |
| **T-03** | Information Disclosure / IDOR | Customer requests details of another customer's account by guessing or enumerating account UUIDs | High | All account endpoints query by both `accountId` and `ownerId = authenticatedUser.id`. Failure returns uniform `404 Not Found` to prevent account enumeration. | `tests/idor.test.ts` | Baseline Defined |
| **T-04** | Tampering / Double Spending | Parallel requests sent to transfer or withdraw funds simultaneously, attempting to exploit race conditions | Critical | PostgreSQL atomic transactions combined with row-level locks (`SELECT ... FOR UPDATE`) serialize account balance updates. Database `CHECK (balance >= 0)` constraint prevents overdrafts. | `tests/concurrency.test.ts` | Baseline Defined |
| **T-05** | Repudiation / Tampering | Rogue actor modifies or deletes audit logs to conceal fraudulent financial transactions | High | Audit logs are append-only. Each log entry incorporates a cryptographic SHA-256 hash chaining to the preceding entry: $h_n = \text{SHA256}(h_{n-1} + \text{data})$. A mathematical verifier detects any broken links. | `tests/audit.test.ts` | Baseline Defined |
| **T-06** | Denial of Service / Brute Force | Attacker attempts credential stuffing or brute-forcing login endpoints | High | Rate limiting applied via Redis (with in-memory fallback for local development). Exponential backoff and account lock thresholds. | `tests/auth.test.ts` | Baseline Defined |
| **T-07** | Tampering / Duplicate Billing | Network timeouts cause client to retry a transfer, resulting in double deduction | High | Client must submit an `Idempotency-Key` header with write operations. Subsequent requests with the same key return the cached original response without re-executing the transfer. | `tests/ledger.test.ts` | Baseline Defined |
| **T-08** | Spoofing / Session Hijacking | Cross-site scripting (XSS) or cross-site request forgery (CSRF) steals or abuses customer session tokens | High | Session tokens stored exclusively in `HttpOnly`, `SameSite=Strict`, `Secure` cookies. State-changing requests require a matching CSRF header token. | `tests/auth.test.ts` | Baseline Defined |
| **T-09** | Information Disclosure | Database errors or unhandled exceptions leak stack traces, SQL queries, or internal table schemas | Medium | Centralized error handler captures all exceptions and maps them to generic, sanitized client responses while logging details internally. | `tests/setup.ts` | Baseline Defined |
| **T-10** | Tampering | Manipulation of transfer amounts (e.g., negative numbers, decimals, non-numeric values) to credit unauthorized funds | High | Strict Zod validation schemas reject any amount that is not a positive integer (minor currency units / cents). Float math is strictly avoided. | `tests/ledger.test.ts` | Baseline Defined |

---

## Known Limitations & Accepted Risks

1. **Hash Chain Tampering with Raw Database Access**:
   * *Risk*: An attacker with direct PostgreSQL superuser write access could recompute all subsequent hashes in the chain from a forged entry forward.
   * *Mitigation*: The chain detects unauthorized application-level mutations. In an enterprise production setting, the tip of the hash chain would periodically be signed with a remote private key and anchored to an external WORM (Write Once Read Many) log sink or public time-stamping authority.
2. **Local Redis Fallback**:
   * *Risk*: In-memory rate limiting does not share state across multi-instance clusters.
   * *Mitigation*: Redis is enforced in production via `REQUIRE_REDIS_IN_PRODUCTION=true`. The in-memory fallback is restricted strictly to single-process local development.
