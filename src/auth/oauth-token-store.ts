import { getRedisClient } from '../redis-client';

const TOKEN_KEY_PREFIX = 'mcp:oauth-token:';
const REDIS_RETRY_ATTEMPTS = 3;
const REDIS_RETRY_BASE_DELAY_MS = 50;

const tokenKey = (credentialCacheKey: string): string => `${TOKEN_KEY_PREFIX}${credentialCacheKey}`;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < REDIS_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < REDIS_RETRY_ATTEMPTS - 1) {
        await sleep(REDIS_RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
  throw lastError;
};

export const getStoredOAuthToken = async (credentialCacheKey: string): Promise<string | undefined> => {
  const token = await withRetry(() => getRedisClient().get(tokenKey(credentialCacheKey)));
  return token ?? undefined;
};

export const storeOAuthToken = async (credentialCacheKey: string, token: string, ttlSeconds: number): Promise<void> => {
  await withRetry(() => getRedisClient().set(tokenKey(credentialCacheKey), token, 'EX', ttlSeconds));
};

export const deleteStoredOAuthToken = async (credentialCacheKey: string): Promise<void> => {
  await withRetry(() => getRedisClient().del(tokenKey(credentialCacheKey)));
};
