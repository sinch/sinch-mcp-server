import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getVoiceV2Client } from './utils/voice-v2-client';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export const AssignNumberToVoiceServiceSchema = {
  phoneNumber: z.string().regex(E164_PATTERN).describe('The active Sinch number to assign, in E.164 format'),
  serviceId: z.string().uuid().describe('The UUID of the Voice service to assign the number to'),
};

type AssignNumberToVoiceService = z.infer<z.ZodObject<typeof AssignNumberToVoiceServiceSchema>>;

const TOOL_KEY: VoiceToolKey = 'assignNumberToVoiceService';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerAssignNumberToVoiceService = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Assign an active Sinch number to a Voice service. The number must belong to the authenticated project and have Voice capability.',
      inputSchema: AssignNumberToVoiceServiceSchema,
    },
    assignNumberToVoiceServiceHandler,
  );
};

export const assignNumberToVoiceServiceHandler = async ({
  phoneNumber,
  serviceId,
}: AssignNumberToVoiceService): Promise<IPromptResponse> => {
  const maybeClient = getVoiceV2Client();
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }

  try {
    const activeNumber = await maybeClient.numbers.update({
      phoneNumber,
      updateActiveNumberRequestBody: {
        voiceConfiguration: {
          type: 'RTC',
          appId: serviceId,
        },
      },
    });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        phone_number: activeNumber.phoneNumber,
        service_id: serviceId,
        voice_configuration: activeNumber.voiceConfiguration,
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
