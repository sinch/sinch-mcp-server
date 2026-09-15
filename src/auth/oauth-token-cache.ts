import { AUTH_HOSTNAME, Oauth2TokenRequest } from '@sinch/sdk-client';
import axios from 'axios';
import { getHttpCredentialSource } from './http-credential-mode';
import { getStoredOAuthToken, storeOAuthToken } from './oauth-token-store';
import type { SinchOAuthCredentials } from './sinch-oauth-credentials';
import { logger } from '../telemetry/logger';

const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_TOKEN_TTL_SECONDS = 3600;
const TOKEN_EXPIRY_SKEW_SECONDS = 60;

type OAuthTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type OAuthRequestOptions = {
  headers: {
    set(name: string, value: string): void;
  };
};

export class RedisBackedOauth2TokenRequest {
  private pendingTokenRefresh: Promise<string> | undefined;
  private forceRefresh = false;

  constructor(private readonly credentials: SinchOAuthCredentials) {}

  getName(): 'Oauth2TokenRequest' {
    return 'Oauth2TokenRequest';
  }

  load(): { transform: <T extends OAuthRequestOptions>(request: T) => Promise<T> } {
    return {
      transform: async <T extends OAuthRequestOptions>(request: T): Promise<T> => {
        const token = await this.getOAuthToken();
        request.headers.set('Authorization', `Bearer ${token}`);
        return request;
      },
    };
  }

  invalidateToken(): void {
    // The API client calls this after a 401. Bypass Redis on the next request
    // and replace the cached value with a freshly issued token.
    this.forceRefresh = true;
  }

  private async getOAuthToken(): Promise<string> {
    if (!this.forceRefresh) {
      try {
        const cached = await getStoredOAuthToken(this.credentials.cacheKey);
        if (cached) {
          return cached;
        }
      } catch (error) {
        logger.warn({ error }, 'Unable to read OAuth token from Redis; requesting a new token');
      }
    }
    this.forceRefresh = false;

    if (!this.pendingTokenRefresh) {
      this.pendingTokenRefresh = this.fetchAndStoreToken().finally(() => {
        this.pendingTokenRefresh = undefined;
      });
    }
    return this.pendingTokenRefresh;
  }

  private async fetchAndStoreToken(): Promise<string> {
    let response;
    try {
      response = await axios.post<OAuthTokenResponse>(
        `${AUTH_HOSTNAME}/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: this.credentials.keyId,
            password: this.credentials.keySecret,
          },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
    } catch {
      // Axios errors include the request config (and therefore Basic auth
      // credentials), so never propagate the original error to application logs.
      throw new Error('Unable to obtain an access token from the Sinch authentication server');
    }

    const token = response.data.access_token;
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('The Sinch authentication server did not return an access token');
    }

    const expiresIn = response.data.expires_in;
    const lifetime =
      typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
        ? Math.floor(expiresIn)
        : DEFAULT_TOKEN_TTL_SECONDS;
    const ttlSeconds = Math.max(1, lifetime - TOKEN_EXPIRY_SKEW_SECONDS);

    try {
      await storeOAuthToken(this.credentials.cacheKey, token, ttlSeconds);
    } catch (error) {
      // Redis is an optimization here. The freshly issued token can still be used
      // for this request; session handling independently reports Redis outages.
      logger.warn({ error }, 'Unable to store OAuth token in Redis');
    }
    return token;
  }
}

type OAuthTokenPlugin = Oauth2TokenRequest | RedisBackedOauth2TokenRequest;

const oauthPluginsByCacheKey = new Map<string, OAuthTokenPlugin>();
let maxEntries = readMaxEntriesFromEnv();

function readMaxEntriesFromEnv(): number {
  const configured = Number(process.env.OAUTH_TOKEN_CACHE_MAX_ENTRIES ?? DEFAULT_MAX_ENTRIES);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_ENTRIES;
}

const touchCacheEntry = (cacheKey: string, plugin: OAuthTokenPlugin): void => {
  oauthPluginsByCacheKey.delete(cacheKey);
  oauthPluginsByCacheKey.set(cacheKey, plugin);
};

const evictOldestEntry = (): void => {
  const oldestKey = oauthPluginsByCacheKey.keys().next().value;
  if (oldestKey !== undefined) {
    oauthPluginsByCacheKey.delete(oldestKey);
  }
};

export const getSharedOauth2TokenRequest = (credentials: SinchOAuthCredentials): OAuthTokenPlugin => {
  const existing = oauthPluginsByCacheKey.get(credentials.cacheKey);
  if (existing) {
    touchCacheEntry(credentials.cacheKey, existing);
    return existing;
  }

  if (oauthPluginsByCacheKey.size >= maxEntries) {
    evictOldestEntry();
  }

  // Redis is mandatory for remote multi-tenant HTTP, but local stdio must keep
  // working without it. Single-tenant HTTP also retains the SDK's native plugin.
  const plugin =
    getHttpCredentialSource() === 'request-header'
      ? new RedisBackedOauth2TokenRequest(credentials)
      : new Oauth2TokenRequest(credentials.keyId, credentials.keySecret);
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
