import { getAuthMode } from './auth-mode';
import { AGENT_ID_HEADER, getRequestSinchOAuthCredentials } from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import { sinchOAuthCredentialsFromEnv, type SinchOAuthCredentials } from './sinch-oauth-credentials';
import { PromptResponse } from '../types';

export const MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE =
  'Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").';

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => {
  // This deployment's Authorization header carries a SinchID token, not credentials: they are
  // resolved from the agent installation instead. That lookup lands with DEVEXP-1631, which
  // replaces this branch.
  if (getAuthMode() === 'sinchid-agent') {
    return new PromptResponse(
      `This deployment resolves Sinch API credentials from the agent installation (${AGENT_ID_HEADER}). ` +
        'That lookup is not implemented yet, so this tool cannot run here.',
    );
  }

  // Multi-tenant HTTP: credentials come only from the Authorization header (no server env).
  if (getHttpCredentialSource() === 'request-header') {
    const fromRequest = getRequestSinchOAuthCredentials();
    if (!fromRequest) {
      return new PromptResponse(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
    }
    return fromRequest;
  }

  // Single-tenant HTTP and stdio: credentials come only from server env.
  const fromEnv = sinchOAuthCredentialsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  return new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
};
