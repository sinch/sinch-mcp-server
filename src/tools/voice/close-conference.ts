import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getVoiceService } from './utils/voice-service-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { logger } from '../../telemetry/logger';

const CloseConferenceSchema = {
  conferenceId: z.string().describe('The conference ID to close'),
};

type CloseConference = z.infer<z.ZodObject<typeof CloseConferenceSchema>>;

const TOOL_KEY: VoiceToolKey = 'closeConference';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCloseConference = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) return;

  registerTracedTool(server,
    TOOL_NAME,
    {
      description: 'Close a conference callout',
      inputSchema: CloseConferenceSchema,
    },
    closeConferenceHandler
  );
};

export const closeConferenceHandler = async (
  { conferenceId }: CloseConference
): Promise<IPromptResponse> => {
  const maybeService = getVoiceService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const voiceService = maybeService;

  try {
    await voiceService.conferences.kickAll({
      conferenceId
    });
    return new PromptResponse(JSON.stringify({
      success: true,
      conference_id: conferenceId
    })).promptResponse;
  } catch (error) {
    logger.error({ err: error, conferenceId }, 'Error closing conference');
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }
};
