import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';
import { E164_PATTERN } from './utils/phone-number';

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
}: AssignNumberToVoiceService): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ numbers }) => {
    const activeNumber = await numbers.update({
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
  });
