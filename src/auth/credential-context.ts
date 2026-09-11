import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingHttpHeaders } from 'node:http';
import { parseSinchCredentialsAuthorizationHeader, type SinchOAuthCredentials } from './sinch-oauth-credentials';
import { extractHeaderValue } from '../utils';
import { decodeUserJwtHeader, type SinchUserClaims } from './user-jwt';

/**
 * Custom header carrying the agent installation identifier (e.g. the Gemini
 * Enterprise Marketplace OrderId). Temporary mechanism until a token-exchange
 * capability is available over M2M authentication; the MCP server will use it
 * to resolve the Sinch credentials for the calling installation.
 */
export const AGENT_ID_HEADER = 'x-agent-id';

type RequestAuthContext = {
  credentials?: SinchOAuthCredentials;
  agentId?: string;
  userClaims?: SinchUserClaims;
};

const requestAuthStorage = new AsyncLocalStorage<RequestAuthContext>();

export const getRequestSinchOAuthCredentials = (): SinchOAuthCredentials | undefined => {
  return requestAuthStorage.getStore()?.credentials;
};

export const getRequestAgentId = (): string | undefined => {
  return requestAuthStorage.getStore()?.agentId;
};

export const getRequestUserClaims = (): SinchUserClaims | undefined => {
  return requestAuthStorage.getStore()?.userClaims;
};

export const runWithHttpCredentialHeaders = <T>(headers: IncomingHttpHeaders, fn: () => T): T => {
  // Both the multi-tenant Sinch credentials (Bearer <Base64 projectId:keyId:keySecret>) and the
  // optional user JWT travel in Authorization; each parser only accepts its own token shape.
  const context: RequestAuthContext = {
    credentials: parseSinchCredentialsAuthorizationHeader(headers.authorization),
    agentId: extractHeaderValue(headers[AGENT_ID_HEADER]),
    userClaims: decodeUserJwtHeader(headers.authorization),
  };
  return requestAuthStorage.run(context, fn);
};
