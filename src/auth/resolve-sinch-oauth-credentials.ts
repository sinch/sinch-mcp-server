import { getRequestSinchOAuthCredentials } from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import {
  sinchOAuthCredentialsFromEnv,
  SINCH_CREDENTIALS_HEADER,
  type SinchOAuthCredentials,
} from './sinch-oauth-credentials';
import { PromptResponse } from '../types';

export const resolveSinchOAuthCredentials = ():
  | SinchOAuthCredentials
  | PromptResponse => {
  // Multi-tenant HTTP: credentials come only from X-Sinch-Credentials (no server env).
  if (getHttpCredentialSource() === 'request-header') {
    const fromRequest = getRequestSinchOAuthCredentials();
    if (!fromRequest) {
      return new PromptResponse(
        `Missing ${SINCH_CREDENTIALS_HEADER} header (Base64 of projectId:keyId:keySecret).`,
      );
    }
    return fromRequest;
  }

  // Single-tenant HTTP and stdio: credentials come only from server env.
  // X-Sinch-Credentials is ignored when MCP_API_KEY is configured (no override).
  const fromEnv = sinchOAuthCredentialsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  return new PromptResponse(
    'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
  );
};
