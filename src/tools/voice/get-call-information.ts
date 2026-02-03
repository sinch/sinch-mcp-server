import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getVoiceClient } from './utils/voice-service-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: VoiceToolKey = 'getCallInformation';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetCallInformation = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Get information about a call using its ID',
    {
      callId: z.string().describe('The call ID to get information about')
    },
    getCallInformationHandler
  );
};

export const getCallInformationHandler = async ({ callId }: { callId: string }): Promise<IPromptResponse> => {
  const maybeClient = getVoiceClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const voiceService = maybeClient.voice;

  try {
    const response = await voiceService.calls.get({ callId });

    return new PromptResponse(JSON.stringify({
      success: true,
      call_information: response
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }
}
