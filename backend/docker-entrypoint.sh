#!/bin/sh
set -e

echo "[LedgerLine Backend] Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[LedgerLine Backend] Database migrations applied successfully."
echo "[LedgerLine Backend] Starting API server on port ${PORT:-5000}..."
exec node dist/server.js
