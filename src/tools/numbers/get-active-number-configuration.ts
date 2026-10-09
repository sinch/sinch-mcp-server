import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { E164_PATTERN } from '../voice/utils/phone-number';
import { getNumbersService } from './utils/numbers-service-helper';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';

export const GetActiveNumberConfigurationSchema = {
  phoneNumber: z
    .string()
    .regex(E164_PATTERN)
    .describe('The active Sinch phone number to retrieve, in E.164 format with a leading `+`'),
};

type GetActiveNumberConfiguration = z.infer<z.ZodObject<typeof GetActiveNumberConfigurationSchema>>;

const TOOL_KEY: NumbersToolKey = 'getActiveNumberConfiguration';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetActiveNumberConfiguration = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
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
}: GetActiveNumberConfiguration): Promise<IPromptResponse> => {
  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }

  try {
    const activeNumber = await maybeService.get({ phoneNumber });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: activeNumber,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: `Failed to retrieve active number '${phoneNumber}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      }),
    ).promptResponse;
  }
};
