import Redis from 'ioredis';
import { env } from './env.js';

export interface ICacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  ping(): Promise<string>;
  isUsingFallback(): boolean;
}

// In-Memory Fallback Client (Strictly for local development and unit tests)
class InMemoryCacheClient implements ICacheClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const current = await this.get(key);
    const nextVal = (current ? parseInt(current, 10) : 0) + 1;
    await this.set(key, nextVal.toString(), ttlSeconds);
    return nextVal;
  }

  async ping(): Promise<string> {
    return 'PONG (In-Memory Fallback)';
  }

  isUsingFallback(): boolean {
    return true;
  }
}

// Real Redis Client
class RealRedisClient implements ICacheClient {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1 && ttlSeconds) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  async ping(): Promise<string> {
    return this.redis.ping();
  }

  isUsingFallback(): boolean {
    return false;
  }
}

let cacheClientInstance: ICacheClient;

export function getCacheClient(): ICacheClient {
  if (cacheClientInstance) {
    return cacheClientInstance;
  }

  if (env.NODE_ENV === 'test') {
    cacheClientInstance = new InMemoryCacheClient();
    return cacheClientInstance;
  }

  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 2) return null; // Stop retrying after 2 attempts
        return 100;
      }
    });

    redis.on('error', (err) => {
      if (env.REQUIRE_REDIS_IN_PRODUCTION || env.NODE_ENV === 'production') {
        console.error('[Redis Fatal] Production requires an active Redis instance:', err.message);
      }
    });

    // Attempt connecting; if local redis is absent and we are in dev mode, use fallback
    cacheClientInstance = new RealRedisClient(redis);
  } catch (err) {
    if (env.REQUIRE_REDIS_IN_PRODUCTION || env.NODE_ENV === 'production') {
      throw new Error(`Production requires an active Redis instance: ${(err as Error).message}`);
    }
    console.warn('[Cache Warning] Redis not reachable, falling back to In-Memory cache for local development');
    cacheClientInstance = new InMemoryCacheClient();
  }

  return cacheClientInstance;
}

