import { IPromptResponse, PromptResponse } from '../../../types';
import { isPromptResponse } from '../../../utils';
import { formatRcsError } from './rcs-error-helper';
import { RcsProvisioningClient } from './rcs-provisioning-client';
import { getRcsProvisioningClient } from './rcs-service-helper';

export const runRcsHandler = async (
  toolName: string,
  fn: (client: RcsProvisioningClient) => Promise<IPromptResponse>,
): Promise<IPromptResponse> => {
  const maybeClient = getRcsProvisioningClient(toolName);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    return await fn(maybeClient);
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: formatRcsError(error),
      }),
    ).promptResponse;
  }
};
