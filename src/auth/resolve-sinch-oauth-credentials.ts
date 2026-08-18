import { getAuthMode } from './auth-mode';
import { resolveAgentCredentials } from './agent-credentials';
import { AGENT_ID_HEADER, getRequestAgentId, getRequestSinchOAuthCredentials } from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import { sinchOAuthCredentialsFromEnv, type SinchOAuthCredentials } from './sinch-oauth-credentials';
import { logger } from '../telemetry/logger';
import { PromptResponse } from '../types';

export const MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE =
  'Missing or invalid Authorization header (expected "Bearer <Base64 of projectId:keyId:keySecret>").';

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => {
  if (getAuthMode() === 'sinchid-agent') {
    const agentId = getRequestAgentId();
    if (!agentId) {
      return new PromptResponse(`Missing ${AGENT_ID_HEADER} header.`);
    }

    const fromAgent = resolveAgentCredentials(agentId);
    if (fromAgent) {
      return fromAgent;
    }
    logger.warn(
      { agent_id: agentId },
      `Unknown agent id in ${AGENT_ID_HEADER} header: not present in the agent credentials map`,
    );
    return new PromptResponse(
      `Unknown agent id "${agentId}": it is not present in the server's agent credentials map.`,
    );
  }

  // client-credentials mode: credentials come from Authorization, never server env.
  if (getHttpCredentialSource() === 'request-header') {
    const fromRequest = getRequestSinchOAuthCredentials();
    if (fromRequest) {
      return fromRequest;
    }

    return new PromptResponse(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
  }

  // Single-tenant HTTP and stdio: credentials come only from server env.
  const fromEnv = sinchOAuthCredentialsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  return new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
};
