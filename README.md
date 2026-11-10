# BalanceVault (LedgerLine)

> **Money movement with a ledger you can prove.**

BalanceVault is a secure financial account management and money-movement web application built for the **Snovasys Fresher Hiring Challenge**. It enforces strict server-side Role-Based Access Control (RBAC), atomic double-entry bookkeeping, race-condition mitigation, customer onboarding lifecycles, and a tamper-evident cryptographic audit trail.

---

## 1. System Architecture

The application is structured as a clean TypeScript monorepo:

* **Backend (`/backend`)**: Node.js & Express with TypeScript, Prisma ORM, and PostgreSQL.
* **Frontend (`/frontend`)**: React 18, Vite, Tailwind CSS, and Lucide icons.
* **Ledger Engine**: Atomic double-entry transactions utilizing PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) to prevent concurrency race conditions and double-spending.
* **Authentication & RBAC**: Password hashing via **Argon2id**, secure HttpOnly cookie session management, CSRF protection, and strict server-side role validation (`ADMIN`, `OPERATOR`, `CUSTOMER`).
* **Audit Trail**: Tamper-evident append-only audit log using chained SHA-256 hashes ($h_n = \text{SHA256}(h_{n-1} + \dots)$) with a cryptographic verification endpoint.
* **Rate Limiting**: Redis-backed rate limiting on authentication and sensitive financial routes, with in-memory fallback enabled strictly for local offline development.

---

## 2. Problem Requirements Mapping

| Requirement | Module / Mechanism | Enforcement Layer |
| :--- | :--- | :--- |
| **1. Registration & Auth** | `auth.controller.ts`, Argon2id, HttpOnly cookies | Backend / Crypto |
| **2. Admin Bootstrap** | `bootstrap-admin.ts` CLI script | One-time secret token |
| **3. Server-side RBAC** | `rbac.ts` middleware (`ADMIN`, `OPERATOR`, `CUSTOMER`) | Server middleware |
| **4. Onboarding Workflow** | `admin.controller.ts`, status `PENDING_APPROVAL` | Database & Business logic |
| **5. Account Management** | `account.controller.ts`, UUID accounts, balance | PostgreSQL & Prisma |
| **6. Atomic Operations** | `ledger.service.ts`, PostgreSQL `$transaction` | DB Transaction / Locks |
| **7. Double-Entry Transfers**| Debits equal credits across accounts | DB Constraints & Service |
| **8. Provable Statements** | Filterable ledger entries with running balance | Database queries |
| **9. Tamper-Evident Audit** | Hash-chained audit logger & verification utility | Cryptographic SHA-256 |
| **10. Health & Readiness** | `/api/health` & `/api/ready` endpoints | Process & Connectivity probes |

---

## 3. Getting Started & How to Run

### Prerequisites
* **Node.js**: v18.0.0 or higher (v24+ supported)
* **npm**: v9.0.0 or higher
* **PostgreSQL**: Local PostgreSQL instance or a serverless cloud instance (e.g., Neon)
* **Redis**: (Optional for local development; required for production)

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/Vijayakumari455/LedgerLine.git
cd LedgerLine
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env` in both root and `backend/`:
```bash
cp .env.example backend/.env
```
Update `DATABASE_URL` with your PostgreSQL connection string.

### Step 3: Database Migration & Schema Generation
```bash
npm run db:generate
npm run db:migrate
```

### Step 4: One-Time Administrator Bootstrap
To securely initialize the primary administrator without exposing an open public endpoint:
```bash
npm run admin:bootstrap
```

### Step 5: Run Automated Security & Functional Tests
```bash
npm test
```

### Step 6: Start Development Environment
```bash
npm run dev
```
* Backend API: `http://localhost:5000`
* Frontend Application: `http://localhost:5173`

---

## 4. Key Architectural & Security Decisions

1. **Argon2id for Password Hashing**:
   * Selected over standard bcrypt for superior resistance against GPU and ASIC side-channel and brute-force attacks.
2. **PostgreSQL Row-Level Locking (`SELECT FOR UPDATE`)**:
   * Prevents balance-draining race conditions when concurrent requests hit the transfer or withdrawal endpoints.
3. **Database-Enforced Non-Negative Balance**:
   * Application-level balance checks are supplemented by a PostgreSQL table constraint (`CHECK (balance >= 0)`) to ensure mathematical consistency even in edge-case anomalies.
4. **Idempotency Keys**:
   * All money movement routes accept a client-generated `Idempotency-Key` header, preventing duplicate debits if a client encounters a network timeout.
5. **Chained Hash Audit Trail Limitations**:
   * Proves internal integrity against non-database tampering. If a rogue database administrator alters records, the mathematical chain breaks. To achieve enterprise WORM immutability, logs would need off-site cryptographic anchoring.

---

## 5. Repository Documentation
* `THREATS.md`: Threat model, STRIDE attack vectors, and matching test references.
* `PROMPTS.md`: Genuine record of AI direction, caught hallucinations, and architectural decisions.
