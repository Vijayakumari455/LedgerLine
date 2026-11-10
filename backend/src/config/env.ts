import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REQUIRE_REDIS_IN_PRODUCTION: z.coerce.boolean().default(false),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters long'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters long'),
  ADMIN_BOOTSTRAP_SECRET: z.string().min(16, 'ADMIN_BOOTSTRAP_SECRET must be at least 16 characters long'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[Config Error] Invalid environment variables:');
  console.error(parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;
