import { IPromptResponse, PromptResponse } from '../../../types';
import { isPromptResponse } from '../../../utils';
import { formatWhatsAppError } from './whatsapp-error-helper';
import { WhatsAppProvisioningClient } from './whatsapp-provisioning-client';
import { getWhatsAppProvisioningClient } from './whatsapp-service-helper';

export const runWhatsAppHandler = async (
  toolName: string,
  fn: (client: WhatsAppProvisioningClient) => Promise<IPromptResponse>,
): Promise<IPromptResponse> => {
  const maybeClient = getWhatsAppProvisioningClient(toolName);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    return await fn(maybeClient);
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: formatWhatsAppError(error),
      }),
    ).promptResponse;
  }
};
