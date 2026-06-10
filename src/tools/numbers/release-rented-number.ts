import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersService } from './utils/numbers-service-helper';

const ReleaseRentedNumberInput = {
  phoneNumber: z
    .string()
    .describe('The phone number in E.164 format with leading `+`'),
};

type ReleaseRentedNumberInputSchema = z.infer<z.ZodObject<typeof ReleaseRentedNumberInput>>;

const TOOL_KEY: NumbersToolKey = 'releaseRentedNumber';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerReleaseRentedNumber = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Releases a rented phone number from your project.',
      inputSchema: ReleaseRentedNumberInput,
    },
    releaseRentedNumberHandler
  );
};

export const releaseRentedNumberHandler = async ({
  phoneNumber,
}: ReleaseRentedNumberInputSchema) => {
  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numbersService = maybeService;

  try {
    const response = await numbersService.release({ phoneNumber });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: response,
      })
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: `Failed to release number '${phoneNumber}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
    ).promptResponse;
  }
};
