jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { buildCredentialCacheKey } from '../../src/auth/sinch-oauth-credentials';
import { deleteStoredOAuthToken, getStoredOAuthToken, storeOAuthToken } from '../../src/auth/oauth-token-store';
import { getRedisClient, resetRedisClientForTests } from '../../src/redis-client';
import { mockEnv } from '../helpers/mock-env';

describe('oauth-token-store', () => {
  const cacheKey = buildCredentialCacheKey('project', 'key', 'secret');

  beforeEach(async () => {
    mockEnv.REDIS_HOST = '127.0.0.1';
    mockEnv.REDIS_PORT = '6379';
    await getRedisClient().flushall();
  });

  afterEach(() => {
    resetRedisClientForTests();
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = undefined;
  });

  it('stores and retrieves an OAuth token without exposing credentials in the Redis key', async () => {
    await storeOAuthToken(cacheKey, 'token-value', 120);

    await expect(getStoredOAuthToken(cacheKey)).resolves.toBe('token-value');
    const keys = await getRedisClient().keys('mcp:oauth-token:*');
    expect(keys).toEqual([`mcp:oauth-token:${cacheKey}`]);
    expect(keys[0]).not.toContain('secret');
  });

  it('sets a TTL on stored tokens', async () => {
    await storeOAuthToken(cacheKey, 'token-value', 120);

    await expect(getRedisClient().ttl(`mcp:oauth-token:${cacheKey}`)).resolves.toBe(120);
  });

  it('returns undefined for a cache miss', async () => {
    await expect(getStoredOAuthToken(cacheKey)).resolves.toBeUndefined();
  });

  it('deletes a cached token', async () => {
    await storeOAuthToken(cacheKey, 'token-value', 120);
    await deleteStoredOAuthToken(cacheKey);

    await expect(getStoredOAuthToken(cacheKey)).resolves.toBeUndefined();
  });
});
