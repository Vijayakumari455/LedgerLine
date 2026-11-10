import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Always log full error details internally for operators/debugging
  console.error('[Unhandled Server Error]', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Never leak internal database schemas, query fragments, or stack traces to external clients
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: isDevelopment ? err.message : 'An unexpected internal error occurred. Please contact support.',
    ...(isDevelopment && { stack: err.stack }),
  });
}

