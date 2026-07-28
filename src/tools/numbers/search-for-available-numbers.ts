import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { getNumbersService } from './utils/numbers-service-helper';

const SearchAvailableNumbersSchema = {
  regionCode: z
    .string()
    .describe('Region code to filter by. ISO 3166-1 alpha-2 country code of the phone number. Example: US, GB or SE.'),
  type: z
    .enum(['MOBILE', 'LOCAL', 'TOLL_FREE'])
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
  capabilities: z
    .array(z.enum(['SMS', 'VOICE']))
    .optional()
    .describe('Number capabilities to filter by SMS and/or VOICE.'),
  size: z.number().optional().describe('Maximum number of phone numbers to return.'),
};

type SearchAvailableNumbers = z.infer<z.ZodObject<typeof SearchAvailableNumbersSchema>>;

const TOOL_KEY: NumbersToolKey = 'searchForAvailableNumbers';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSearchAvailableNumbers = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Search for available Sinch virtual phone numbers you can rent later. Use this when the user wants to find or browse numbers (by country/region, type LOCAL/MOBILE/TOLL_FREE, area-code pattern, or SMS/VOICE capability) but has not yet chosen a specific E.164 number to activate. Do NOT use this to activate/rent a known number — use rent-sinch-virtual-numbers for that. If the user asks vaguely for "a support line" or "a number" without region/type, ask for country/region (and optionally area code or capabilities) before calling, or call this tool once those filters are clear.',
      inputSchema: SearchAvailableNumbersSchema,
    },
    searchAvailableNumbersHandler,
  );
};

export const searchAvailableNumbersHandler = async ({
  regionCode,
  type,
  searchPattern,
  patternPosition,
  capabilities,
  size,
}: SearchAvailableNumbers) => {
  const maybeService = getNumbersService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const numbersService = maybeService;

  try {
    const response = await numbersService.searchForAvailableNumbers({
      regionCode,
      type,
      'numberPattern.pattern': searchPattern,
      'numberPattern.searchPattern': patternPosition,
      capabilities,
      size,
    });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        data: response.availableNumbers,
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
