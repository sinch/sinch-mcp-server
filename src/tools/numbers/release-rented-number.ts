import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersService } from './utils/numbers-service-helper';

const TOOL_KEY: NumbersToolKey = 'releaseRentedNumber';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerReleaseRentedNumber = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Releases an active phone number from your project.',
    {
      phoneNumber: z
        .string()
        .describe('The phone number in E.164 format with leading `+`'),
    },
    releaseRentedNumberHandler
  );
};

export const releaseRentedNumberHandler = async ({
  phoneNumber,
}: {
  phoneNumber: string;
}) => {
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
