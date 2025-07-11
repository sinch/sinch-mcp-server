import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getVoiceClient } from './utils/voice-service-helper';
import { getToolName, shouldRegisterTool, VoiceToolKey } from './utils/voice-tools-helper';

const TOOL_KEY: VoiceToolKey = 'closeConference';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCloseConference = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
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
  const maybeClient = getVoiceClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const voiceService = maybeClient.voice;

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
