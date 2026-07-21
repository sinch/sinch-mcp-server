import { env } from '../../../env';
import { PromptResponse } from '../../../types';
import { WhatsAppProvisioningClient } from './whatsapp-provisioning-client';

export const getWhatsAppProvisioningClient = (toolName: string): WhatsAppProvisioningClient | PromptResponse => {
  const projectId = env.PROJECT_ID;
  const keyId = env.KEY_ID;
  const keySecret = env.KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
      }),
    );
  }

  return new WhatsAppProvisioningClient(projectId, keyId, keySecret, toolName);
};
