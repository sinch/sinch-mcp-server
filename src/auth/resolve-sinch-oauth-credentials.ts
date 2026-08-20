import { resolveAgentCredentials } from './agent-credentials';
import { AGENT_ID_HEADER, getRequestAgentId, getRequestSinchOAuthCredentials } from './credential-context';
import { getHttpCredentialSource } from './http-credential-mode';
import {
  sinchOAuthCredentialsFromEnv,
  SINCH_CREDENTIALS_HEADER,
  type SinchOAuthCredentials,
} from './sinch-oauth-credentials';
import { logger } from '../telemetry/logger';
import { PromptResponse } from '../types';

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => {
  // Multi-tenant HTTP: credentials come from the request, never from the server env.
  if (getHttpCredentialSource() === 'request-header') {
    // When x-agent-id is sent, it is the only credential mechanism considered: an
    // unknown agent id fails immediately (fail-closed) rather than silently falling
    // back to X-Sinch-Credentials, so configuration mistakes surface right away.
    const agentId = getRequestAgentId();
    if (agentId) {
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

    const fromRequest = getRequestSinchOAuthCredentials();
    if (fromRequest) {
      return fromRequest;
    }

    return new PromptResponse(`Missing ${SINCH_CREDENTIALS_HEADER} header (Base64 of projectId:keyId:keySecret).`);
  }

  // Single-tenant HTTP and stdio: credentials come only from server env.
  // Request headers are ignored when MCP_API_KEY is configured (no override).
  const fromEnv = sinchOAuthCredentialsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  return new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
};
