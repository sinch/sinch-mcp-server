import { getAuthMode } from './auth-mode';
import { resolveAgentCredentials } from './agent-credentials';
import {
  AGENT_ID_HEADER,
  getRequestAgentId,
  getRequestSinchOAuthCredentials,
  getRequestUserClaims,
} from './credential-context';
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

    // ZAP is responsible for authenticating the JWT upstream. The MCP server uses
    // its projectId claim with the OrderId to select this installation's credentials.
    const projectId = getRequestUserClaims()?.projectId;
    if (!projectId) {
      return new PromptResponse(`Missing project id in the Authorization JWT for ${AGENT_ID_HEADER} "${agentId}".`);
    }

    const fromAgent = resolveAgentCredentials(agentId, projectId);
    if (fromAgent) {
      return fromAgent;
    }
    logger.warn(
      { agent_id: agentId, project_id: projectId },
      'Unknown agent and project combination: not present in the agent credentials map',
    );
    return new PromptResponse(
      `Unknown agent and project combination "${agentId}:${projectId}": ` +
        "it is not present in the server's agent credentials map.",
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
