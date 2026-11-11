# LedgerLine

> **Money movement with a ledger you can prove.**

LedgerLine is a secure financial account management and money-movement web application built for the **Snovasys Fresher Hiring Challenge 2026**. It enforces strict server-side Role-Based Access Control (RBAC), atomic double-entry bookkeeping, race-condition mitigation, customer onboarding lifecycles, and a tamper-evident cryptographic audit trail.

---

## 1. System Architecture

The application is structured as a clean TypeScript monorepo:

* **Backend (`/backend`)**: Node.js & Express with TypeScript, Prisma ORM, and PostgreSQL 16.
* **Frontend (`/frontend`)**: React 18, Vite, Tailwind CSS, Lucide icons, and Nginx reverse proxy in production.
* **Ledger Engine**: Atomic double-entry transactions utilizing PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) with lexicographical locking order to prevent deadlocks and race conditions.
* **Authentication & RBAC**: Password hashing via **Argon2id**, secure HttpOnly cookie session management, CSRF double-submit protection, and strict server-side role validation (`ADMIN`, `OPERATOR`, `CUSTOMER`).
* **Audit Trail**: Tamper-evident append-only audit log using chained SHA-256 hashes ($h_n = \text{SHA256}(h_{n-1} + \dots)$) with a cryptographic verification API and interactive UI badge.
* **Rate Limiting & Cache**: Redis-backed rate limiting on authentication and sensitive financial routes, with in-memory fallback enabled strictly for local offline development.

---

## 2. Challenge Requirements Compliance Matrix

| Requirement | Module / Mechanism | Enforcement Layer | Status |
| :--- | :--- | :--- | :---: |
| **1. Registration & Auth** | `auth.controller.ts`, Argon2id, HttpOnly cookies, CSRF | Backend / Crypto | Complete |
| **2. Admin Bootstrap** | `bootstrap-admin.ts` CLI script | One-time secret token | Complete |
| **3. Server-side RBAC** | `rbac.ts` middleware (`ADMIN`, `OPERATOR`, `CUSTOMER`) | Server middleware | Complete |
| **4. Onboarding Workflow** | `admin.controller.ts`, status `PENDING_APPROVAL`, session revocation | Database & Business logic | Complete |
| **5. Account Management** | `account.controller.ts`, UUID accounts, balance tracking | PostgreSQL & Prisma | Complete |
| **6. Atomic Operations** | `ledger.service.ts`, PostgreSQL `$transaction`, row locks | DB Transaction / Locks | Complete |
| **7. Double-Entry Transfers**| Debits equal credits across accounts (`SYSTEM-SETTLEMENT-CLEARING`) | DB Constraints & Service | Complete |
| **8. Provable Statements** | Filterable ledger entries with running balance | Database queries | Complete |
| **9. Tamper-Evident Audit** | Hash-chained audit logger, `/api/audit/verify` endpoint & UI explorer | Cryptographic SHA-256 | Complete |
| **10. Health & Readiness** | `/api/health` & `/api/ready` endpoints with DB & Redis checks | Process & Connectivity probes | Complete |

---

## 3. Quick Start with Docker Compose (Recommended)

The entire application stack—PostgreSQL 16, Redis 7, Backend API, and Frontend with Nginx—can be launched with Docker Compose.

### 3.1 Prerequisites
* **Docker Engine**: v24.0.0 or higher
* **Docker Compose**: v2.20.0 or higher

### 3.2 Environment Configuration
Before starting the containers, create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Ensure the following required secrets are configured in `.env`:
* `POSTGRES_PASSWORD`: Strong password for the PostgreSQL database.
* `JWT_SECRET`: Minimum 32 cryptographically random characters.
* `COOKIE_SECRET`: Minimum 32 cryptographically random characters.
* `CSRF_SECRET`: Minimum 32 cryptographically random characters.
* `ADMIN_BOOTSTRAP_SECRET`: Minimum 16 characters for administrative bootstrap.

> **Security Note**: Docker Compose will refuse to start if any of these production secrets are missing or blank.

### 3.3 One-Command Startup
Build and launch the containerized environment:

```bash
docker compose up --build -d
```

### 3.4 Database Migration Behavior
The `backend` container's entrypoint (`docker-entrypoint.sh`) executes `./node_modules/.bin/prisma migrate deploy` upon startup once PostgreSQL passes its health check. All database tables, indexes, and PostgreSQL `CHECK` constraints (`balance >= 0`, `amount > 0`) are created automatically before the Express API begins accepting requests.

### 3.5 One-Time Administrator Bootstrap
To initialize the primary administrator account in the running backend container:

```bash
docker compose exec backend npm run admin:bootstrap
```

* **Default Administrator**: `admin@ledgerline.local` (configurable via `ADMIN_BOOTSTRAP_EMAIL` in `.env`).
* **Protection**: Re-run attempts are strictly rejected by the server with `BOOTSTRAP_ALREADY_COMPLETED`.

### 3.6 Application Access URLs
* **Frontend Web Dashboard**: [`http://localhost`](http://localhost) (Nginx port 80)
* **Backend API Base**: [`http://localhost:5000`](http://localhost:5000)
* **Liveness Probe**: [`http://localhost:5000/api/health`](http://localhost:5000/api/health)
* **Readiness Probe**: [`http://localhost:5000/api/ready`](http://localhost:5000/api/ready)

### 3.7 Container Health Verification
To inspect running containers and their health status:

```bash
docker compose ps
```

All four services (`ledgerline-postgres`, `ledgerline-redis`, `ledgerline-backend`, `ledgerline-frontend`) should display status `Up (healthy)`.

### 3.8 Shutdown & Reset Instructions
To stop all containers:
```bash
docker compose down
```

To stop containers and delete persistent PostgreSQL and Redis volumes:
```bash
docker compose down -v
```

### 3.9 Docker Troubleshooting
* **Inspect Service Logs**:
  ```bash
  docker compose logs -f backend
  docker compose logs -f postgres
  docker compose logs -f redis
  docker compose logs -f frontend
  ```
* **Port Conflict on Port 80 or 5000**: Ensure no local web server is occupying ports 80 or 5000, or modify the host port mappings in `docker-compose.yml`.
* **Database Readiness Timeout**: If PostgreSQL takes longer than expected to initialize on older hardware, the backend health check retries automatically for 50 seconds.

---

## 4. Local Manual Development (Without Docker)

### 4.1 Prerequisites
* **Node.js**: v20.0.0 or higher
* **npm**: v9.0.0 or higher
* **PostgreSQL**: Local PostgreSQL 16 instance or serverless database (Neon / Supabase)
* **Redis**: (Optional; in-memory fallback is active when `NODE_ENV=development`)

### 4.2 Installation & Setup
```bash
# 1. Clone & Install Dependencies
git clone https://github.com/Vijayakumari455/LedgerLine.git
cd LedgerLine
npm install

# 2. Configure Environment
cp .env.example .env
cp .env.example backend/.env
# Edit DATABASE_URL in backend/.env with your PostgreSQL credentials

# 3. Database Migration & Schema Generation
npm run db:generate
npm run db:migrate

# 4. Bootstrap Administrator
npm run admin:bootstrap:dev   # or npm run admin:bootstrap after building

# 5. Run Automated Tests
npm test

# 6. Start Development Servers
npm run dev
```

* **Backend API**: `http://localhost:5000`
* **Frontend Application**: `http://localhost:5173` (Vite dev server)

---

## 5. One-Time Administrator Bootstrap CLI

The bootstrap system provides a secure, one-time mechanism to provision the initial administrator without exposing public HTTP endpoints.

### Rules & Invariants:
1. **Zero Public HTTP Endpoints**: Bootstrap is executed strictly via local CLI or `docker compose exec`.
2. **Secret Requirement**: Requires `ADMIN_BOOTSTRAP_SECRET` matching the server's configured environment.
3. **One-Time Invariant**: Before provisioning, the script queries the database for any existing user with `role === Role.ADMIN`. If found, it immediately aborts with `BOOTSTRAP_ALREADY_COMPLETED`.
4. **Argon2id Hashing**: Admin credentials are encrypted using memory-hard Argon2id parameters.
5. **Cryptographic Audit**: The bootstrap event is recorded in the SHA-256 chained audit trail.

### CLI Commands:
* **Production** (using compiled dist):
  ```bash
  npm run admin:bootstrap
  ```
* **Development** (using tsx directly):
  ```bash
  npm run admin:bootstrap:dev
  ```

---

## 6. Automated Test Suite

The test suite validates financial correctness, security boundaries, race-condition handling, and cryptographic invariants.

### 6.1 Test Execution Commands
* **Run All Tests**:
  ```bash
  npm test
  ```
* **Run Concurrency Tests**:
  ```bash
  npm run test:concurrency
  ```
* **Run Audit Chain Verification Tests**:
  ```bash
  npm run test:audit
  ```
* **Run TypeScript Type Checks**:
  ```bash
  npm run typecheck --workspace=backend
  npm run typecheck --workspace=frontend
  ```

### 6.2 Test Coverage Categories
1. **Mathematical Schema & Invariants (`schema.test.ts`)**:
   - Minor integer currency units (paise/cents) precision ($0.10 + 0.20 = 0.30$).
   - Rejection of floating-point drift and invalid decimal representations.
2. **Authentication & RBAC (`auth.test.ts`)**:
   - Argon2id password hashing and verification.
   - HttpOnly cookie session issuance and server-side invalidation.
   - Timing-safe double-submit CSRF token validation.
   - Strict RBAC middleware enforcement across `ADMIN`, `OPERATOR`, and `CUSTOMER` roles.
3. **Administrative Controls & Onboarding (`admin.test.ts`)**:
   - One-time bootstrap secret validation and second-attempt rejection.
   - Customer onboarding review (`PENDING_APPROVAL` $\to$ `ACTIVE` or `REJECTED`).
   - Session revocation upon customer suspension or rejection.
   - Account freeze and unfreeze controls.
4. **Double-Entry Ledger Engine (`ledger.test.ts`)**:
   - Deposit, withdrawal, and transfer balancing ($\sum \text{Debits} == \sum \text{Credits}$).
   - System settlement account balancing invariants.
   - Insufficient funds rejection.
   - Idempotency key replay (`200 OK`) and payload mismatch rejection (`422 Unprocessable Entity`).
   - IDOR (Insecure Direct Object Reference) access protection.
5. **Concurrency & Race Conditions (`concurrency.test.ts`)**:
   - Simulated concurrent transfers and withdrawals against single accounts.
   - Lexicographical account locking order preventing cyclic deadlocks.
   - In-flight duplicate request locking (`409 Conflict`).
6. **Cryptographic Audit Trail (`audit-crypto.test.ts`, `audit-api.test.ts`)**:
   - SHA-256 hash chaining ($h_n = \text{SHA256}(h_{n-1} + \dots)$).
   - Tamper detection: modification of past payloads or hashes breaks the chain.
   - API verification endpoint (`/api/audit/verify`).
   - Advisory lock concurrency on audit chain writes.

---

## 7. Production Deployment & Security Controls

### 7.1 Defense-in-Depth Container Hardening
* **Multi-Stage Builds**: Development dependencies and TypeScript compilers are stripped from the final runtime images.
* **Non-Root Execution**: The backend container runs as dedicated user `ledgerline` (`UID 1001`) with home directory created and permissions strictly bounded.
* **Init Process**: `dumb-init` acts as PID 1 to properly handle and forward POSIX signals (`SIGTERM`, `SIGINT`) for graceful shutdown.
* **Nginx Reverse Proxy**:
  - Serves compiled static assets with gzip compression and immutable caching.
  - Proxies `/api` routes to the backend service.
  - Preserves authentication cookies (`Set-Cookie`), CSRF headers (`X-CSRF-Token`), and idempotency headers.
  - Enforces HTTP security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, and `Referrer-Policy`.

### 7.2 Environment Variable Reference

| Variable | Description | Requirement | Default (Dev) |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | Optional | `development` |
| `PORT` | Backend HTTP listening port | Optional | `5000` |
| `CORS_ORIGIN` | Allowed CORS origin URL | Optional | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | **Required** | None |
| `POSTGRES_USER` | PostgreSQL container user | Required in Docker | `ledgerline` |
| `POSTGRES_PASSWORD` | PostgreSQL container password | **Required** | None |
| `POSTGRES_DB` | PostgreSQL container database name | Required in Docker | `ledgerline` |
| `REDIS_URL` | Redis connection URL | Optional in Dev | `redis://localhost:6379` |
| `REQUIRE_REDIS_IN_PRODUCTION` | Mandate Redis availability in production | Optional | `true` |
| `JWT_SECRET` | Cryptographic secret for JWT signing ($\ge 32$ chars) | **Required** | None |
| `COOKIE_SECRET` | Secret for cookie signing ($\ge 32$ chars) | **Required** | None |
| `CSRF_SECRET` | Secret for CSRF token generation ($\ge 32$ chars) | **Required** | None |
| `ADMIN_BOOTSTRAP_SECRET` | Secret for one-time admin provisioning ($\ge 16$ chars) | **Required** | None |
| `ADMIN_BOOTSTRAP_EMAIL` | Initial administrator email address | Optional | `admin@ledgerline.local` |

---

## 8. Repository Documentation
* `THREATS.md`: Threat model, STRIDE attack vectors, and matching test references.
* `PROMPTS.md`: Genuine record of AI direction, caught hallucinations, and architectural decisions.
