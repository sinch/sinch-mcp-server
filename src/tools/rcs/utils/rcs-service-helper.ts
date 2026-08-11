import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { PromptResponse } from '../../../types';
import { isPromptResponse } from '../../../utils';
import { RcsProvisioningClient } from './rcs-provisioning-client';

export const getRcsProvisioningClient = (toolName: string): RcsProvisioningClient | PromptResponse => {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials;
  }
  const { projectId, keyId, keySecret } = maybeCredentials;

  return new RcsProvisioningClient(projectId, keyId, keySecret, toolName);
};
