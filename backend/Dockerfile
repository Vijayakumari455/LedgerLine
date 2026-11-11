# ==============================================================================
# Stage 1: Build & Compilation Stage (Monorepo Context)
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL required by Prisma engine binaries
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy root monorepo package manifests and backend package manifest
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies using the synchronized root lockfile for backend workspace
RUN npm ci --workspace=backend

# Copy Prisma schema and migrations
COPY backend/prisma ./backend/prisma/

# Copy backend TypeScript source code and configuration
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/

# Generate Prisma client for TypeScript compilation
RUN npm --workspace=backend run db:generate

# Compile backend TypeScript to JavaScript in backend/dist/
RUN npm --workspace=backend run build

# Prune development dependencies to keep production image minimal
RUN npm prune --omit=dev --workspace=backend

# Regenerate Prisma client directly into the pruned production node_modules
RUN npm --workspace=backend run db:generate

# ==============================================================================
# Stage 2: Production Runtime Stage
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies:
# - openssl: required for Prisma query engine
# - dumb-init: lightweight init system for proper PID 1 signal handling (SIGTERM/SIGINT)
RUN apt-get update -y && apt-get install -y openssl dumb-init && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Security: Create non-root user and group with an explicit home directory (-m)
RUN groupadd -g 1001 nodejs && useradd -m -u 1001 -g nodejs -s /bin/sh ledgerline

# Copy production node_modules from builder
COPY --from=builder --chown=ledgerline:nodejs /app/node_modules ./node_modules

# Copy compiled application code
COPY --from=builder --chown=ledgerline:nodejs /app/backend/dist ./dist

# Copy Prisma schema and migrations (needed for prisma migrate deploy)
COPY --from=builder --chown=ledgerline:nodejs /app/backend/prisma ./prisma

# Copy package manifest
COPY --from=builder --chown=ledgerline:nodejs /app/backend/package.json ./package.json

# Copy and configure entrypoint script
COPY --chown=ledgerline:nodejs backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER ledgerline

EXPOSE 5000

# Use dumb-init to ensure signals (like SIGTERM during shutdown) are forwarded to Node
ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]
