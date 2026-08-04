import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingHttpHeaders } from 'node:http';
import {
  parseSinchCredentialsHeader,
  SINCH_CREDENTIALS_HEADER,
  type SinchOAuthCredentials,
} from './sinch-oauth-credentials';

const credentialStorage = new AsyncLocalStorage<SinchOAuthCredentials | undefined>();

export const getRequestSinchOAuthCredentials = (): SinchOAuthCredentials | undefined => {
  return credentialStorage.getStore();
};

export const runWithHttpCredentialHeaders = <T>(headers: IncomingHttpHeaders, fn: () => T): T => {
  const credentials = parseSinchCredentialsHeader(headers[SINCH_CREDENTIALS_HEADER]);
  return credentialStorage.run(credentials, fn);
};
