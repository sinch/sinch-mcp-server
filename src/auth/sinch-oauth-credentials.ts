import { createHash } from 'node:crypto';
import { env } from '../env';
import { extractBearerToken } from './bearer-token';

// Standard Base64 alphabet only (no line breaks, no base64url). Node's decoder is lenient
// and silently drops invalid characters, so validate the shape explicitly: a token that
// is not Base64 (e.g. a JWT or an opaque API key) must never be mistaken for credentials.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const AGENT_M2M_KEY_PART_PATTERN = /^[A-Za-z0-9.-]+$/;
const MAX_AGENT_M2M_ENV_VAR_NAME_LENGTH = 253;

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
 * keyed by orderId (x-agent-id) and Sinch project id (verified from the SinchID JWT claim).
 * Identifiers are restricted to the Kubernetes Secret/env-name character set without `_`,
 * because `_` separates the two components and accepting it would make the mapping ambiguous.
 */
export const buildAgentM2MEnvVarName = (orderId: string, projectId: string): string | undefined => {
  if (!AGENT_M2M_KEY_PART_PATTERN.test(orderId) || !AGENT_M2M_KEY_PART_PATTERN.test(projectId)) {
    return undefined;
  }

  const name = `sinch-agent-m2m_${orderId}_${projectId}`;
  return name.length <= MAX_AGENT_M2M_ENV_VAR_NAME_LENGTH ? name : undefined;
};

export const sinchOAuthCredentialsFromAgentEnv = (
  orderId: string,
  projectId: string,
): SinchOAuthCredentials | undefined => {
  const envVarName = buildAgentM2MEnvVarName(orderId, projectId);
  if (!envVarName) {
    return undefined;
  }

  const raw = process.env[envVarName];
  if (!raw) {
    return undefined;
  }

  const credentials = parseSinchCredentialsValue(raw);
  return credentials?.projectId === projectId ? credentials : undefined;
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
