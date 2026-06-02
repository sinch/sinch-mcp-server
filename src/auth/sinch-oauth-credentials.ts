import { createHash } from 'crypto';
import { getRequestSinchOAuthCredentials } from './credential-context';
import { env } from '../env';
import { PromptResponse } from '../types';

export const SINCH_CREDENTIALS_HEADER = 'x-sinch-credentials';

export type SinchOAuthCredentials = {
  projectId: string;
  keyId: string;
  keySecret: string;
  cacheKey: string;
};

export const buildCredentialCacheKey = (
  projectId: string,
  keyId: string,
  keySecret: string,
): string => {
  return createHash('sha256')
    .update(`${projectId}:${keyId}:${keySecret}`)
    .digest('hex');
};

export const parseSinchCredentialsValue = (
  encodedValue: string,
): SinchOAuthCredentials | undefined => {
  const trimmed = encodedValue.trim();
  if (!trimmed) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, 'base64').toString('utf8');
  } catch {
    return undefined;
  }

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

export const parseSinchCredentialsHeader = (
  headerValue: string | string[] | undefined,
): SinchOAuthCredentials | undefined => {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value) {
    return undefined;
  }

  return parseSinchCredentialsValue(value);
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

export const resolveSinchOAuthCredentials = ():
  | SinchOAuthCredentials
  | PromptResponse => {
  const fromRequest = getRequestSinchOAuthCredentials();
  if (fromRequest) {
    return fromRequest;
  }

  const fromEnv = sinchOAuthCredentialsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  return new PromptResponse(
    'Missing Sinch credentials. Set PROJECT_ID, KEY_ID, and KEY_SECRET, '
    + `or send the ${SINCH_CREDENTIALS_HEADER} header (Base64 of projectId:keyId:keySecret).`,
  );
};
