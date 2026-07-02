import { Oauth2TokenRequest } from '@sinch/sdk-client';
import {
  clearOauthTokenCacheForTests,
  getSharedOauth2TokenRequest,
  setOauthTokenCacheMaxEntriesForTests,
} from '../../src/auth/oauth-token-cache';
import { buildCredentialCacheKey } from '../../src/auth/sinch-oauth-credentials';

const makeCreds = (projectId: string, keyId: string, keySecret: string) => ({
  projectId,
  keyId,
  keySecret,
  cacheKey: buildCredentialCacheKey(projectId, keyId, keySecret),
});

describe('oauth-token-cache', () => {
  beforeEach(() => {
    clearOauthTokenCacheForTests();
  });

  it('reuses Oauth2TokenRequest for the same credential cache key', () => {
    const creds = makeCreds('p', 'k', 's');

    const first = getSharedOauth2TokenRequest(creds);
    const second = getSharedOauth2TokenRequest(creds);

    expect(first).toBe(second);
    expect(first).toBeInstanceOf(Oauth2TokenRequest);
  });

  it('creates separate plugins for different credentials', () => {
    const credsA = makeCreds('p1', 'k1', 's1');
    const credsB = makeCreds('p2', 'k2', 's2');

    expect(getSharedOauth2TokenRequest(credsA)).not.toBe(getSharedOauth2TokenRequest(credsB));
  });

  it('evicts the least recently used entry when the cache is full', () => {
    setOauthTokenCacheMaxEntriesForTests(2);

    const credsA = makeCreds('p1', 'k1', 's1');
    const credsB = makeCreds('p2', 'k2', 's2');
    const credsC = makeCreds('p3', 'k3', 's3');

    const pluginA = getSharedOauth2TokenRequest(credsA);
    getSharedOauth2TokenRequest(credsB);
    getSharedOauth2TokenRequest(credsC);

    const pluginAAfterEviction = getSharedOauth2TokenRequest(credsA);
    const pluginBAfterEviction = getSharedOauth2TokenRequest(credsB);

    expect(pluginAAfterEviction).not.toBe(pluginA);
    expect(pluginBAfterEviction).toBe(getSharedOauth2TokenRequest(credsB));
  });

  it('keeps a recently used entry when the cache is full', () => {
    setOauthTokenCacheMaxEntriesForTests(2);

    const credsA = makeCreds('p1', 'k1', 's1');
    const credsB = makeCreds('p2', 'k2', 's2');
    const credsC = makeCreds('p3', 'k3', 's3');

    const pluginB = getSharedOauth2TokenRequest(credsB);
    getSharedOauth2TokenRequest(credsA);
    getSharedOauth2TokenRequest(credsB);
    getSharedOauth2TokenRequest(credsC);

    expect(getSharedOauth2TokenRequest(credsB)).toBe(pluginB);
  });
});
