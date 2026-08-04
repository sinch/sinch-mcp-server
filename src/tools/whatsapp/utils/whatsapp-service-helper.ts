import { resolveSinchOAuthCredentials } from '../../../auth/resolve-sinch-oauth-credentials';
import { PromptResponse } from '../../../types';
import { isPromptResponse } from '../../../utils';
import { WhatsAppProvisioningClient } from './whatsapp-provisioning-client';

export const getWhatsAppProvisioningClient = (toolName: string): WhatsAppProvisioningClient | PromptResponse => {
  const maybeCredentials = resolveSinchOAuthCredentials();
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials;
  }
  const { projectId, keyId, keySecret } = maybeCredentials;

  return new WhatsAppProvisioningClient(projectId, keyId, keySecret, toolName);
};
