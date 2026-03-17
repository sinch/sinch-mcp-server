import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersService } from './utils/numbers-service-helper';
import { Numbers } from '@sinch/numbers';

const TOOL_KEY: NumbersToolKey = 'rentNumbers';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerRentNumbers = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Activates a phone number that matches the search criteria provided in the request. Currently the rentAny operation works only for US LOCAL numbers',
    {
      numbers: z.array(z.string()).describe('Array of phone numbers to rent. Each number should be in E.164 format with leading `+`'),
    },
    rentNumbersHandler
  );
}

export const rentNumbersHandler = async (
  { numbers }: { numbers: string[]; }
) => {

  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numbersService = maybeService;

  const successfulRentals: Array<{ number: string; details: Numbers.ActiveNumber }> = [];
  const failedRentals: Array<{ number: string; error: string }> = [];

  for (const number of numbers) {
    try {
      const response = await numbersService.rent({
        phoneNumber: number,
        rentNumberRequestBody: {}
      });
      successfulRentals.push({ number, details: response });
    } catch (error) {
      failedRentals.push({
        number,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return new PromptResponse(JSON.stringify({
    success: failedRentals.length === 0,
    successful_rentals: successfulRentals,
    failed_rentals: failedRentals,
    summary: {
      total: numbers.length,
      successful: successfulRentals.length,
      failed: failedRentals.length
    }
  })).promptResponse;
};
