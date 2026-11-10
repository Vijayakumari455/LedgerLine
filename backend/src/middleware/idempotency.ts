import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../types/auth.js';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

export function computeRequestHash(body: unknown): string {
  const serialized = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Enterprise Idempotency Middleware:
 * - Scoped strictly to authenticated user and route.
 * - Stores SHA-256 payload hash and rejects reuse with different payloads (422).
 * - Detects concurrent in-flight requests and returns 409 Conflict.
 * - Replays completed responses with identical HTTP status and body.
 */
export async function requireIdempotency(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawKey = req.headers[IDEMPOTENCY_HEADER] as string | undefined;

  // 1. Enforce presence of Idempotency-Key on financial write requests
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    res.status(400).json({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Financial write operations require an Idempotency-Key header to prevent duplicate execution',
    });
    return;
  }

  const key = rawKey.trim();

  // Validate format (min 8 chars, max 128 chars)
  if (key.length < 8 || key.length > 128) {
    res.status(400).json({
      error: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key header must be between 8 and 128 characters in length',
    });
    return;
  }

  if (!req.user) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'You must be signed in to perform this action',
    });
    return;
  }

  const currentPayloadHash = computeRequestHash(req.body);
  req.idempotencyKey = key;

  try {
    // 2. Lookup existing key in database
    const existing = await prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (existing) {
      // Security Check: Key registered to another user
      if (existing.userId !== req.user.id) {
        res.status(403).json({
          error: 'IDEMPOTENCY_KEY_COLLISION',
          message: 'The provided Idempotency-Key is registered to another user account',
        });
        return;
      }

      // Security Check: Key reused with a different request payload
      if (existing.requestHash !== currentPayloadHash) {
        res.status(422).json({
          error: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: 'Idempotency-Key has already been used with a different request payload',
        });
        return;
      }

      // Concurrency Check: Request is currently in progress
      if (existing.responseCode === 0) {
        res.status(409).json({
          error: 'TRANSACTION_IN_PROGRESS',
          message: 'A transaction with this Idempotency-Key is currently being processed. Please retry shortly.',
        });
        return;
      }

      // Replay completed response
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(existing.responseCode).json(existing.responseBody);
      return;
    }

    // 3. Atomically register key in PROCESSING state (responseCode: 0)
    await prisma.idempotencyRecord.create({
      data: {
        key,
        userId: req.user.id,
        route: req.originalUrl,
        requestHash: currentPayloadHash,
        responseCode: 0, // 0 signifies IN_PROGRESS
        responseBody: {},
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
      },
    });

    // 4. Intercept response to update record with final response status & body
    const originalJson = res.json.bind(res);

    res.json = (body: Record<string, unknown>): Response => {
      // Update record with completed response
      prisma.idempotencyRecord
        .update({
          where: { key },
          data: {
            responseCode: res.statusCode,
            responseBody: body,
          },
        })
        .catch((err) => {
          console.error('[Idempotency Finalization Error]', (err as Error).message);
        });

      return originalJson(body);
    };

    next();
  } catch (err) {
    // Handle database uniqueness collision if two identical requests insert at the exact same millisecond
    const error = err as Record<string, unknown>;
    if (error.code === 'P2002') {
      res.status(409).json({
        error: 'TRANSACTION_CONCURRENCY_CONFLICT',
        message: 'Concurrent duplicate request detected with identical Idempotency-Key',
      });
      return;
    }

    console.error('[Idempotency Error]', err);
    next(err);
  }
}
