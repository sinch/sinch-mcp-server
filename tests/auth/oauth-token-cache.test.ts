import { Oauth2TokenRequest } from '@sinch/sdk-client';
import {
  clearOauthTokenCacheForTests,
  getSharedOauth2TokenRequest,
} from '../../src/auth/oauth-token-cache';
import { buildCredentialCacheKey } from '../../src/auth/sinch-oauth-credentials';

describe('oauth-token-cache', () => {
  beforeEach(() => {
    clearOauthTokenCacheForTests();
  });

  it('reuses Oauth2TokenRequest for the same credential cache key', () => {
    const creds = {
      projectId: 'p',
      keyId: 'k',
      keySecret: 's',
      cacheKey: buildCredentialCacheKey('p', 'k', 's'),
    };

    const first = getSharedOauth2TokenRequest(creds);
    const second = getSharedOauth2TokenRequest(creds);

    expect(first).toBe(second);
    expect(first).toBeInstanceOf(Oauth2TokenRequest);
  });

  it('creates separate plugins for different credentials', () => {
    const credsA = {
      projectId: 'p1',
      keyId: 'k1',
      keySecret: 's1',
      cacheKey: buildCredentialCacheKey('p1', 'k1', 's1'),
    };
    const credsB = {
      projectId: 'p2',
      keyId: 'k2',
      keySecret: 's2',
      cacheKey: buildCredentialCacheKey('p2', 'k2', 's2'),
    };

    expect(getSharedOauth2TokenRequest(credsA)).not.toBe(getSharedOauth2TokenRequest(credsB));
  });
});
