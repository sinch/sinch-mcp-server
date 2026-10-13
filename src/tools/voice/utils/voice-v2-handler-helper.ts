import { IPromptResponse, PromptResponse } from '../../../types';
import { isPromptResponse } from '../../../utils';
import { getVoiceV2Client, VoiceV2Client } from './voice-v2-client';

export const runVoiceV2Handler = async (
  toolName: string,
  fn: (client: VoiceV2Client) => Promise<IPromptResponse>,
): Promise<IPromptResponse> => {
  const maybeClient = getVoiceV2Client(toolName);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    return await fn(maybeClient);
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    ).promptResponse;
  }
};
