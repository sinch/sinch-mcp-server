import { Oauth2TokenRequest } from '@sinch/sdk-client';
import type { SinchOAuthCredentials } from './sinch-oauth-credentials';

const oauthPluginsByCacheKey = new Map<string, Oauth2TokenRequest>();

export const getSharedOauth2TokenRequest = (
  credentials: SinchOAuthCredentials,
): Oauth2TokenRequest => {
  const existing = oauthPluginsByCacheKey.get(credentials.cacheKey);
  if (existing) {
    return existing;
  }

  const plugin = new Oauth2TokenRequest(credentials.keyId, credentials.keySecret);
  oauthPluginsByCacheKey.set(credentials.cacheKey, plugin);
  return plugin;
};

export const clearOauthTokenCacheForTests = (): void => {
  oauthPluginsByCacheKey.clear();
};
