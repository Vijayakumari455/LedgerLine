import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getCacheClient } from './config/redis.js';
import { prisma } from './config/database.js';

export const createApp = (): Application => {
  const app: Application = express();

  // 1. Security HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    })
  );

  // 2. CORS configuration with credentials enabled for HttpOnly cookies
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
      exposedHeaders: ['X-CSRF-Token', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    })
  );

  // 3. Body and Cookie Parsers
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.use(express.json({ limit: '10kb' })); // Prevents massive payload DOS attacks

  // 4. Liveness Probe (Does not depend on external services)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'BalanceVault Backend API',
    });
  });

  // 5. Readiness Probe (Checks DB and Redis connectivity)
  app.get('/api/ready', async (_req: Request, res: Response) => {
    const checks: { database: string; redis: string } = {
      database: 'UNKNOWN',
      redis: 'UNKNOWN',
    };

    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      checks.database = 'CONNECTED';
    } catch {
      checks.database = 'DISCONNECTED';
    }

    try {
      const cache = getCacheClient();
      await cache.ping();
      checks.redis = cache.isUsingFallback() ? 'CONNECTED (IN_MEMORY_FALLBACK)' : 'CONNECTED';
    } catch {
      checks.redis = 'DISCONNECTED';
    }

    const isReady = checks.database === 'CONNECTED';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'READY' : 'NOT_READY',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // 6. API Route Handlers
  app.use('/api/auth', authRouter);

  // 7. 404 Catch-All Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist',
    });
  });

  // 8. Centralized Security Error Handler
  app.use(errorHandler);

  return app;
};
