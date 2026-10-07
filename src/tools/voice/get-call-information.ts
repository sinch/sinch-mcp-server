import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getVoiceV2Client } from './utils/voice-v2-client';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const GetCallInformationSchema = {
  callId: z.string().trim().min(1).describe('The voice call ID (not a session ID)'),
};

type GetCallInformation = z.infer<z.ZodObject<typeof GetCallInformationSchema>>;

const TOOL_KEY: VoiceToolKey = 'getCallInformation';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetCallInformation = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get status and details for one voice call leg by call ID. A call ID is different from the session ID returned by tts-callout. Do not use this to place a call or send an SMS.',
      inputSchema: GetCallInformationSchema,
    },
    getCallInformationHandler,
  );
};

export const getCallInformationHandler = async ({ callId }: GetCallInformation): Promise<IPromptResponse> => {
  const maybeClient = getVoiceV2Client();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    const response = await maybeClient.voice.calls.get({ callId });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        call_information: response,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    ).promptResponse;
  }
};
