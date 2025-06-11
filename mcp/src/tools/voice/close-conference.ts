import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hasMatchingTag, isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getVoiceService } from './utils/voice-service-helper';

export const registerCloseConference = (server: McpServer, tags: Tags[]) => {
  if (!hasMatchingTag(['all', 'voice'], tags)) {
    return;
  }

  server.tool(
    'close-conference',
    'Close a conference callout',
    {
      conferenceId: z.string().describe('The conference ID to close')
    },
    closeConferenceHandler
  );
};

export const closeConferenceHandler = async (
  { conferenceId }: { conferenceId: string }
): Promise<IPromptResponse> => {
  const maybeVoiceService = getVoiceService();
  if (isPromptResponse(maybeVoiceService)) {
    return maybeVoiceService.promptResponse;
  }
  const voiceService = maybeVoiceService;

  try {
    await voiceService.conferences.kickAll({
      conferenceId
    });
  } catch (error) {
    console.error(`Error closing conference ${conferenceId}:`, error);
    return new PromptResponse(`An error occurred while trying to close the conference with ID ${conferenceId}. Please try again later.`).promptResponse;
  }

  return new PromptResponse(`The conference ${conferenceId} has been closed successfully.`).promptResponse;
};
