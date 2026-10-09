import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { E164_PATTERN } from './utils/phone-number';
import { runVoiceV2Handler } from './utils/voice-v2-handler-helper';
import { getToolName, VoiceToolKey, voiceToolsConfig } from './utils/voice-tools-helper';

export const GetActiveNumberConfigurationSchema = {
  phoneNumber: z
    .string()
    .regex(E164_PATTERN)
    .describe('The active Sinch phone number to retrieve, in E.164 format with a leading `+`'),
};

type GetActiveNumberConfiguration = z.infer<z.ZodObject<typeof GetActiveNumberConfigurationSchema>>;

const TOOL_KEY: VoiceToolKey = 'getActiveNumberConfiguration';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetActiveNumberConfiguration = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, voiceToolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get one active Sinch number and its full configuration by exact E.164 phone number. Returns capabilities, current SMS and Voice configuration, and scheduled Voice provisioning status. Use scheduledVoiceProvisioning to determine whether a Voice service assignment is waiting, in progress, or failed; when assignment completes, the current appId appears in voiceConfiguration.',
      inputSchema: GetActiveNumberConfigurationSchema,
    },
    getActiveNumberConfigurationHandler,
  );
};

export const getActiveNumberConfigurationHandler = async ({
  phoneNumber,
}: GetActiveNumberConfiguration): Promise<IPromptResponse> =>
  runVoiceV2Handler(TOOL_NAME, async ({ numbers }) => {
    const activeNumber = await numbers.get({ phoneNumber });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: activeNumber,
      }),
    ).promptResponse;
  });
