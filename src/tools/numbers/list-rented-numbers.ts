import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersService } from './utils/numbers-service-helper';

const ListRentedNumbersSchema = {
  regionCode: z
    .string()
    .optional()
    .describe('Region code to filter by. ISO 3166-1 alpha-2 country code of the phone number. Example: US, GB or SE.'),
  type: z
    .enum(['MOBILE', 'LOCAL', 'TOLL_FREE'])
    .optional()
    .describe('Number type to filter by. Options include, MOBILE, LOCAL or TOLL_FREE.'),
  searchPattern: z
    .string()
    .optional()
    .describe(
      'Sequence of digits to search for. If you prefer or need certain digits in sequential order, you can enter the sequence of numbers here. For example, `2020`.',
    ),
  patternPosition: z
    .enum(['START', 'CONTAINS', 'END'])
    .optional()
    .describe(
      'Position of the search pattern. Options include START, END or CONTAINS. If you want the search pattern to be at the beginning of the phone number, select START. If you want it at the end, select END. If you want it to be anywhere in the phone number, select CONTAINS.',
    ),
  capability: z.enum(['SMS', 'VOICE']).optional().describe('Number capabilities to filter by SMS and/or VOICE.'),
  size: z.number().optional().describe('Maximum number of phone numbers to return.'),
};

type ListRentedNumbers = z.infer<z.ZodObject<typeof ListRentedNumbersSchema>>;

const TOOL_KEY: NumbersToolKey = 'listRentedNumbers';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListRentedNumbers = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'List phone numbers already rented/active on this project. Optional filters: region, type, digit pattern, SMS/VOICE capability. Use this to see what you own — not to find numbers still available to buy (use search-for-available-numbers) and not to look up carrier/line type for an arbitrary number (use number-lookup).',
      inputSchema: ListRentedNumbersSchema,
    },
    listRentedNumbersHandler,
  );
};

export const listRentedNumbersHandler = async ({
  regionCode,
  type,
  searchPattern,
  patternPosition,
  capability,
  size,
}: ListRentedNumbers) => {
  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numbersService = maybeService;

  try {
    const page = await numbersService.list({
      regionCode,
      type,
      'numberPattern.pattern': searchPattern,
      'numberPattern.searchPattern': patternPosition,
      capability,
      pageSize: size,
    });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: page.data,
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
