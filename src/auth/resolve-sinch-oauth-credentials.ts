import { getAuthMode } from './auth-mode';
import { AGENT_ID_HEADER, getRequestSinchOAuthCredentials } from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import {
  sinchOAuthCredentialsFromEnv,
  SINCH_CREDENTIALS_HEADER,
  type SinchOAuthCredentials,
} from './sinch-oauth-credentials';
import { PromptResponse } from '../types';

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => {
  // This mode rejects X-Sinch-Credentials, so pointing the caller at it would contradict the
  // deployment. Credentials will come from the agent installation instead.
  if (getAuthMode() === 'sinchid-agent') {
    return new PromptResponse(
      `This deployment does not accept ${SINCH_CREDENTIALS_HEADER}: it resolves Sinch API credentials from the ` +
        `agent installation (${AGENT_ID_HEADER}). That lookup is not implemented yet, so this tool cannot run here.`,
    );
  }

  // Multi-tenant HTTP: credentials come only from X-Sinch-Credentials (no server env).
  if (getHttpCredentialSource() === 'request-header') {
    return (
      getRequestSinchOAuthCredentials() ??
      new PromptResponse(`Missing ${SINCH_CREDENTIALS_HEADER} header (Base64 of projectId:keyId:keySecret).`)
    );
  }

  // Single-tenant HTTP and stdio: credentials come only from server env.
  // X-Sinch-Credentials is ignored when MCP_API_KEY is configured (no override).
  return sinchOAuthCredentialsFromEnv() ?? new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
};
