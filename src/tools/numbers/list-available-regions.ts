import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersClient } from './utils/numbers-service-helper';

const TOOL_KEY: NumbersToolKey = 'listAvailableRegions';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAvailableRegions = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Lists all regions for numbers provided for the project ID.',
    {
      types: z.array(z.enum(['MOBILE', 'LOCAL', 'TOLL_FREE'])).optional().describe('Only return regions for which numbers are provided with the given types: MOBILE, LOCAL or TOLL_FREE.'),
    },
    listAvailableRegionsHandler
  );
}

export const listAvailableRegionsHandler = async (
  { types }: {
    types?: ('MOBILE' | 'LOCAL' | 'TOLL_FREE')[];
  }
) => {

  const maybeService = getNumbersClient(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numbersService = maybeService;

  try{
    const response = await numbersService.availableRegions.list({
      types
    });
    return new PromptResponse(JSON.stringify({
      success: true,
      data: response.availableRegions
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error))
    })).promptResponse;
  }


};
