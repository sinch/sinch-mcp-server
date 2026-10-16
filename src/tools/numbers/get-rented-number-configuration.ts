import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { E164_PATTERN } from '../voice/utils/phone-number';
import { getNumbersService } from './utils/numbers-service-helper';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';

export const GetRentedNumberConfigurationSchema = {
  phoneNumber: z
    .string()
    .regex(E164_PATTERN)
    .describe('The rented Sinch phone number to retrieve, in E.164 format with a leading `+`'),
};

type GetRentedNumberConfiguration = z.infer<z.ZodObject<typeof GetRentedNumberConfigurationSchema>>;

const TOOL_KEY: NumbersToolKey = 'getRentedNumberConfiguration';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetRentedNumberConfiguration = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get a rented Sinch number by its exact E.164 phone number, including its metadata, capabilities, and current service configuration. Provisioning updates are asynchronous: while an update is pending, its future configuration and status appear in the corresponding `scheduled*Provisioning` property.',
      inputSchema: GetRentedNumberConfigurationSchema,
    },
    getRentedNumberConfigurationHandler,
  );
};

export const getRentedNumberConfigurationHandler = async ({
  phoneNumber,
}: GetRentedNumberConfiguration): Promise<IPromptResponse> => {
  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }

  try {
    const rentedNumber = await maybeService.get({ phoneNumber });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: rentedNumber,
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
