import { getAuthMode } from './auth-mode';
import {
  AGENT_ID_HEADER,
  getRequestAgentId,
  getRequestAgentSinchOAuthCredentials,
  getRequestSinchOAuthCredentials,
  getRequestUserClaims,
} from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import { sinchOAuthCredentialsFromEnv, type SinchOAuthCredentials } from './sinch-oauth-credentials';
import { PromptResponse } from '../types';
import { logger } from '../telemetry/logger';

export const MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE =
  'Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").';

export const MISSING_AGENT_INSTALLATION_MESSAGE =
  `This deployment resolves Sinch API credentials from the agent installation (${AGENT_ID_HEADER}) ` +
  'and the verified Sinch project ID from the SinchID access token.';

export const MISSING_AGENT_CREDENTIALS_MESSAGE = 'No Sinch API credentials are configured for this agent installation.';

/**
 * Resolves the M2M credentials for a `sinchid-agent` request: orderId (x-agent-id) and Sinch
 * project id (from verified SinchID JWT claims) together name a Google Secret Manager secret.
 * The HTTP request layer loads and validates that secret before dispatching the MCP request.
 */
const resolveAgentInstallationCredentials = (): SinchOAuthCredentials | PromptResponse => {
  const orderId = getRequestAgentId();
  const projectId = getRequestUserClaims()?.projectId;
  if (!orderId || !projectId) {
    return new PromptResponse(MISSING_AGENT_INSTALLATION_MESSAGE);
  }

  const credentials = getRequestAgentSinchOAuthCredentials();
  if (!credentials || credentials.projectId !== projectId) {
    logger.warn({ agent_id: orderId }, 'No Sinch API credentials configured for this agent installation');
    return new PromptResponse(MISSING_AGENT_CREDENTIALS_MESSAGE);
  }

  return credentials;
};

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => {
  if (getAuthMode() === 'sinchid-agent') {
    return resolveAgentInstallationCredentials();
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
