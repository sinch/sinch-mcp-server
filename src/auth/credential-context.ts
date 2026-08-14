import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingHttpHeaders } from 'node:http';
import { AGENT_ID_HEADER, parseAgentIdHeader } from './agent-id';
import {
  parseSinchCredentialsHeader,
  SINCH_CREDENTIALS_HEADER,
  type SinchOAuthCredentials,
} from './sinch-oauth-credentials';

type RequestAuthContext = {
  credentials?: SinchOAuthCredentials;
  agentId?: string;
};

const requestAuthStorage = new AsyncLocalStorage<RequestAuthContext>();

export const getRequestSinchOAuthCredentials = (): SinchOAuthCredentials | undefined => {
  return requestAuthStorage.getStore()?.credentials;
};

export const getRequestAgentId = (): string | undefined => {
  return requestAuthStorage.getStore()?.agentId;
};

export const runWithHttpCredentialHeaders = <T>(headers: IncomingHttpHeaders, fn: () => T): T => {
  const context: RequestAuthContext = {
    credentials: parseSinchCredentialsHeader(headers[SINCH_CREDENTIALS_HEADER]),
    agentId: parseAgentIdHeader(headers[AGENT_ID_HEADER]),
  };
  return requestAuthStorage.run(context, fn);
};
