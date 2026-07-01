import { Oauth2TokenRequest } from '@sinch/sdk-client';
import type { SinchOAuthCredentials } from './sinch-oauth-credentials';

const DEFAULT_MAX_ENTRIES = 256;

const oauthPluginsByCacheKey = new Map<string, Oauth2TokenRequest>();

let maxEntries = readMaxEntriesFromEnv();

function readMaxEntriesFromEnv(): number {
  const configured = Number(process.env.OAUTH_TOKEN_CACHE_MAX_ENTRIES ?? DEFAULT_MAX_ENTRIES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_ENTRIES;
}

const touchCacheEntry = (cacheKey: string, plugin: Oauth2TokenRequest): void => {
  oauthPluginsByCacheKey.delete(cacheKey);
  oauthPluginsByCacheKey.set(cacheKey, plugin);
};

const evictOldestEntry = (): void => {
  const oldestKey = oauthPluginsByCacheKey.keys().next().value;
  if (oldestKey !== undefined) {
    oauthPluginsByCacheKey.delete(oldestKey);
  }
};

export const getSharedOauth2TokenRequest = (
  credentials: SinchOAuthCredentials,
): Oauth2TokenRequest => {
  const existing = oauthPluginsByCacheKey.get(credentials.cacheKey);
  if (existing) {
    touchCacheEntry(credentials.cacheKey, existing);
    return existing;
  }

  if (oauthPluginsByCacheKey.size >= maxEntries) {
    evictOldestEntry();
  }

  const plugin = new Oauth2TokenRequest(credentials.keyId, credentials.keySecret);
  oauthPluginsByCacheKey.set(credentials.cacheKey, plugin);
  return plugin;
};

export const setOauthTokenCacheMaxEntriesForTests = (max: number): void => {
  maxEntries = max;
};

export const clearOauthTokenCacheForTests = (): void => {
  oauthPluginsByCacheKey.clear();
  maxEntries = readMaxEntriesFromEnv();
};
