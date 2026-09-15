jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));
jest.mock('axios');

import axios from 'axios';
import {
  clearOauthTokenCacheForTests,
  getSharedOauth2TokenRequest,
  RedisBackedOauth2TokenRequest,
} from '../../src/auth/oauth-token-cache';
import { clearHttpCredentialSourceForTests, setHttpCredentialSource } from '../../src/auth/http-credential-mode';
import { getStoredOAuthToken, storeOAuthToken } from '../../src/auth/oauth-token-store';
import { getRedisClient, resetRedisClientForTests } from '../../src/redis-client';
import { buildCredentialCacheKey } from '../../src/auth/sinch-oauth-credentials';
import { mockEnv } from '../helpers/mock-env';

const credentials = {
  projectId: 'project',
  keyId: 'key',
  keySecret: 'secret',
  cacheKey: buildCredentialCacheKey('project', 'key', 'secret'),
};

const applyPlugin = async (
  plugin = getSharedOauth2TokenRequest(credentials) as RedisBackedOauth2TokenRequest,
): Promise<Map<string, string>> => {
  const headers = new Map<string, string>();
  await plugin.load().transform({ headers });
  return headers;
};

describe('RedisBackedOauth2TokenRequest', () => {
  beforeEach(async () => {
    mockEnv.REDIS_HOST = '127.0.0.1';
    mockEnv.REDIS_PORT = '6379';
    setHttpCredentialSource('request-header');
    clearOauthTokenCacheForTests();
    jest.clearAllMocks();
    await getRedisClient().flushall();
  });

  afterEach(() => {
    resetRedisClientForTests();
    clearHttpCredentialSourceForTests();
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = undefined;
  });

  it('fetches, stores, and applies a token on a Redis miss', async () => {
    jest.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'new-token', expires_in: 3600 },
    });

    const headers = await applyPlugin();

    expect(headers.get('Authorization')).toBe('Bearer new-token');
    await expect(getStoredOAuthToken(credentials.cacheKey)).resolves.toBe('new-token');
    await expect(getRedisClient().ttl(`mcp:oauth-token:${credentials.cacheKey}`)).resolves.toBe(3540);
    expect(axios.post).toHaveBeenCalledWith(
      'https://auth.sinch.com/oauth2/token',
      'grant_type=client_credentials',
      expect.objectContaining({
        auth: { username: 'key', password: 'secret' },
      }),
    );
  });

  it('reuses a Redis token across plugin instances without calling Sinch auth', async () => {
    await storeOAuthToken(credentials.cacheKey, 'cached-token', 120);

    const headers = await applyPlugin();

    expect(headers.get('Authorization')).toBe('Bearer cached-token');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('shares one token request between concurrent calls in the same process', async () => {
    jest.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'new-token', expires_in: 3600 },
    });
    const plugin = getSharedOauth2TokenRequest(credentials) as RedisBackedOauth2TokenRequest;

    const [first, second] = await Promise.all([applyPlugin(plugin), applyPlugin(plugin)]);

    expect(first.get('Authorization')).toBe('Bearer new-token');
    expect(second.get('Authorization')).toBe('Bearer new-token');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('bypasses a cached token after invalidation and replaces it', async () => {
    await storeOAuthToken(credentials.cacheKey, 'stale-token', 120);
    jest.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'replacement-token', expires_in: 3600 },
    });
    const plugin = getSharedOauth2TokenRequest(credentials) as RedisBackedOauth2TokenRequest;

    expect((await applyPlugin(plugin)).get('Authorization')).toBe('Bearer stale-token');
    plugin.invalidateToken();
    expect((await applyPlugin(plugin)).get('Authorization')).toBe('Bearer replacement-token');
    await expect(getStoredOAuthToken(credentials.cacheKey)).resolves.toBe('replacement-token');
  });

  it('rejects a successful auth response without an access token', async () => {
    jest.mocked(axios.post).mockResolvedValue({ data: { expires_in: 3600 } });

    await expect(applyPlugin()).rejects.toThrow('did not return an access token');
  });

  it('does not propagate an Axios error that may contain credentials', async () => {
    jest.mocked(axios.post).mockRejectedValue(new Error('request failed with secret'));

    await expect(applyPlugin()).rejects.toThrow(
      'Unable to obtain an access token from the Sinch authentication server',
    );
    await expect(applyPlugin()).rejects.not.toThrow('secret');
  });
});
