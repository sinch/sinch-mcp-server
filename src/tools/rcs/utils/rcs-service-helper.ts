import { env } from '../../../env';
import { PromptResponse } from '../../../types';
import { RcsProvisioningClient } from './rcs-provisioning-client';

export const getRcsProvisioningClient = (toolName: string): RcsProvisioningClient | PromptResponse => {
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

  return new RcsProvisioningClient(projectId, keyId, keySecret, toolName);
};
