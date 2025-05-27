import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse } from '../../utils';
import { PromptResponse } from '../../types';
import { getVoiceService } from './utils/voice-service-helper';

export const registerCloseConference = (server: McpServer) => {
  server.tool('close-conference', 'Close a conference callout', {
    conferenceId: z.string().describe('The conference ID to close')
  },
  async ({ conferenceId }) => {

    const maybeClient = getVoiceService();
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

    return new PromptResponse('All participants have been kicked from the conference.').promptResponse;
  });
};
