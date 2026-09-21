import { createHash } from 'node:crypto';
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

/**
 * Name of the env var holding the M2M credentials for one agent installation: the same
 * Base64 projectId:keyId:keySecret blob used in the client-credentials Authorization header,
 * keyed by orderId (x-agent-id) and Sinch project id (verified from the SinchID JWT claim) so distinct
 * installations never collide. Underscore-joined, not dash-joined as the ticket's literal naming suggests:
 * Kubernetes' default env-var-name validation is a C-identifier (letters/digits/underscore
 * only), and this name is set as a literal container env var name via envFrom/secretKeyRef.
 */
export const buildAgentM2MEnvVarName = (orderId: string, projectId: string): string => {
  return `SINCH_AGENT_M2M_${orderId}_${projectId}`;
};

export const sinchOAuthCredentialsFromAgentEnv = (
  orderId: string,
  projectId: string,
): SinchOAuthCredentials | undefined => {
  const raw = process.env[buildAgentM2MEnvVarName(orderId, projectId)];
  if (!raw) {
    return undefined;
  }

  return parseSinchCredentialsValue(raw);
};

export const SERVER_CREDENTIAL_ENV_VARS = ['PROJECT_ID', 'KEY_ID', 'KEY_SECRET'] as const;

/** Which of the three server-credential env vars are populated. All three or none is valid. */
export const presentServerCredentialEnvVars = (): string[] => {
  return SERVER_CREDENTIAL_ENV_VARS.filter((key) => Boolean(env[key]?.trim()));
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
