import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../env';
import { extractBearerToken } from './bearer-token';

// Standard Base64 alphabet only (no line breaks, no base64url). Node's decoder is lenient
// and silently drops invalid characters, so validate the shape explicitly: a token that
// is not Base64 (e.g. a JWT or an opaque API key) must never be mistaken for credentials.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type SinchOAuthCredentials = {
  projectId: string;
  keyId: string;
  keySecret: string;
  cacheKey: string;
};

export const buildCredentialCacheKey = (projectId: string, keyId: string, keySecret: string): string => {
  return createHash('sha256').update(`${projectId}:${keyId}:${keySecret}`).digest('hex');
};

export const parseSinchCredentialsValue = (encodedValue: string): SinchOAuthCredentials | undefined => {
  const trimmed = encodedValue.trim();
  if (!trimmed || !BASE64_PATTERN.test(trimmed)) {
    return undefined;
  }

  const decoded = Buffer.from(trimmed, 'base64').toString('utf8');

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return undefined;
  }

  const projectId = decoded.slice(0, separatorIndex);
  const remainder = decoded.slice(separatorIndex + 1);
  const keyIdSeparatorIndex = remainder.indexOf(':');
  if (keyIdSeparatorIndex < 0) {
    return undefined;
  }

  // projectId and keyId are UUIDs (no colons); split only on the first two separators
  // so keySecret is everything after the second colon (colons in the secret are unlikely but safe).
  const keyId = remainder.slice(0, keyIdSeparatorIndex);
  const keySecret = remainder.slice(keyIdSeparatorIndex + 1);

  if (!projectId || !keyId || !keySecret) {
    return undefined;
  }

  return {
    projectId,
    keyId,
    keySecret,
    cacheKey: buildCredentialCacheKey(projectId, keyId, keySecret),
  };
};

/**
 * Parses Sinch credentials from an `Authorization: Bearer <Base64 of projectId:keyId:keySecret>`
 * header. Returns undefined when the header is missing, uses another scheme, or the token
 * is not a well-formed encoded credential triple (e.g. a user JWT or an MCP API key).
 */
export const parseSinchCredentialsAuthorizationHeader = (
  authorizationHeader: string | string[] | undefined,
): SinchOAuthCredentials | undefined => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return undefined;
  }

  return parseSinchCredentialsValue(token);
};

export const sinchOAuthCredentialsFromEnv = (): SinchOAuthCredentials | undefined => {
  const projectId = env.PROJECT_ID?.trim();
  const keyId = env.KEY_ID?.trim();
  const keySecret = env.KEY_SECRET?.trim();

  if (!projectId || !keyId || !keySecret) {
    return undefined;
  }

  return {
    projectId,
    keyId,
    keySecret,
    cacheKey: buildCredentialCacheKey(projectId, keyId, keySecret),
  };
};

/**
 * True when the presented credentials are the ones this server holds. Compares the SHA-256
 * cache keys so the check is constant-time over fixed-length digests, never over the secret.
 */
export const matchesServerCredentials = (presented: SinchOAuthCredentials): boolean => {
  const server = sinchOAuthCredentialsFromEnv();
  if (!server) {
    return false;
  }

  return timingSafeEqual(Buffer.from(presented.cacheKey, 'hex'), Buffer.from(server.cacheKey, 'hex'));
};
