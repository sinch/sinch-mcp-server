import { sinchOAuthCredentialsFromEnv, type SinchOAuthCredentials } from './sinch-oauth-credentials';
import { PromptResponse } from '../types';

export type SinchOAuthCredentialsResolver = () => SinchOAuthCredentials | PromptResponse;

let resolveCredentials: SinchOAuthCredentialsResolver = () =>
  sinchOAuthCredentialsFromEnv() ??
  new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.', { isError: true });

export const setSinchOAuthCredentialsResolver = (resolver: SinchOAuthCredentialsResolver): void => {
  resolveCredentials = resolver;
};

export const resolveSinchOAuthCredentials = (): SinchOAuthCredentials | PromptResponse => resolveCredentials();
