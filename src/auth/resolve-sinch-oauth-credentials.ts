import { getRequestSinchOAuthCredentials } from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import { sinchOAuthCredentialsFromEnv, type SinchOAuthCredentials } from './sinch-oauth-credentials';
import { PromptResponse } from '../types';

export const MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE =
  'Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").';

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => {
  // Multi-tenant HTTP: credentials come only from the Authorization header (no server env).
  if (getHttpCredentialSource() === 'request-header') {
    const fromRequest = getRequestSinchOAuthCredentials();
    if (!fromRequest) {
      return new PromptResponse(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
    }
    return fromRequest;
  }

  // Single-tenant HTTP and stdio: credentials come only from server env.
  // Any credentials in Authorization are ignored when MCP_API_KEY is configured (no override).
  const fromEnv = sinchOAuthCredentialsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  return new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
};
