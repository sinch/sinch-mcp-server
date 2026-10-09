import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

const GetSessionInformationSchema = {
  sessionId: z.string().trim().min(1).describe('The voice session ID'),
};

type GetSessionInformation = z.infer<z.ZodObject<typeof GetSessionInformationSchema>>;

const TOOL_KEY: VoiceToolKey = 'getSessionInformation';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetSessionInformation = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get voice session details by session ID, including all call legs associated with the session. Use get-call-information instead when you have a call ID.',
      inputSchema: GetSessionInformationSchema,
    },
    getSessionInformationHandler,
  );
};

export const getSessionInformationHandler = async ({ sessionId }: GetSessionInformation): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ voice }) => {
    const response = await voice.sessions.get({ sessionId });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        session_information: response,
      }),
    ).promptResponse;
  });
