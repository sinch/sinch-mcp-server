import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersService } from './utils/numbers-service-helper';

const ListAvailableRegionsSchema = {
  types: z
    .array(z.enum(['MOBILE', 'LOCAL', 'TOLL_FREE']))
    .optional()
    .describe('Only return regions for which numbers are provided with the given types: MOBILE, LOCAL or TOLL_FREE.'),
};

type ListAvailableRegions = z.infer<z.ZodObject<typeof ListAvailableRegionsSchema>>;

const TOOL_KEY: NumbersToolKey = 'listAvailableRegions';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAvailableRegions = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'List countries/regions where Sinch virtual numbers are available to search and rent. Use when the user asks where they can buy numbers or which regions are offered. Optional filter by number types (MOBILE, LOCAL, TOLL_FREE). If the user later wants to find candidates in a region, they can follow up with search-for-available-numbers.',
      inputSchema: ListAvailableRegionsSchema,
    },
    listAvailableRegionsHandler,
  );
};

export const listAvailableRegionsHandler = async ({ types }: ListAvailableRegions) => {
  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numbersService = maybeService;

  try {
    const response = await numbersService.availableRegions.list({
      types,
    });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: response.availableRegions,
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
