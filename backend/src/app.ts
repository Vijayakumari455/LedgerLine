import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

export const createApp = (): Application => {
  const app: Application = express();

  // Basic security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10kb' }));

  // Scaffolding baseline health route
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'BalanceVault Backend API'
    });
  });

  return app;
};

