import Redis from 'ioredis';
import { env } from './env';

const REDIS_COMMAND_TIMEOUT_MS = 250;

const REDIS_CLIENT_OPTIONS = {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  retryStrategy: (times: number) => Math.min(times * 100, 2000),
};

let client: Redis | undefined;

/**
 * Shared Redis connection for session and OAuth token storage.
 * TLS turns on automatically with a password (AWS ElastiCache requires it).
 */
export const getRedisClient = (): Redis => {
  if (!client) {
    client = new Redis({
      host: env.REDIS_HOST,
      port: Number(env.REDIS_PORT),
      password: env.REDIS_PASSWORD,
      tls: env.REDIS_PASSWORD ? {} : undefined,
      ...REDIS_CLIENT_OPTIONS,
    });
    client.on('error', (error) => console.error('Redis client error:', error));
  }
  return client;
};

/** Exposed for tests to reset the module-level client between suites. */
export const resetRedisClientForTests = (): void => {
  client?.disconnect();
  client = undefined;
};
