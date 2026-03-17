import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PromptResponse, Tags } from '../../types';
import { formatUserAgent, matchesAnyTag } from '../../utils';
import { getToolName, NumbersToolKey, toolsConfig } from './utils/numbers-tools-helper';
import { Numbers } from '@sinch/numbers';

const TOOL_KEY: NumbersToolKey = 'listRentedNumbers';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListRentedNumbers = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Lists all active numbers for a project.',
    {
      regionCode: z.string().optional().describe('Region code to filter by. ISO 3166-1 alpha-2 country code of the phone number. Example: US, GB or SE.'),
      type: z.enum(['MOBILE', 'LOCAL', 'TOLL_FREE']).optional().describe('Number type to filter by. Options include, MOBILE, LOCAL or TOLL_FREE.'),
      searchPattern: z.string().optional().describe('Sequence of digits to search for. If you prefer or need certain digits in sequential order, you can enter the sequence of numbers here. For example, `2020`.'),
      patternPosition: z.enum(['START', 'CONTAINS', 'END']).optional().describe('Position of the search pattern. Options include START, END or CONTAINS. If you want the search pattern to be at the beginning of the phone number, select START. If you want it at the end, select END. If you want it to be anywhere in the phone number, select CONTAINS.'),
      capability: z.enum(['SMS', 'VOICE']).optional().describe('Number capabilities to filter by SMS and/or VOICE.'),
      size: z.number().optional().describe('Maximum number of phone numbers to return.'),
    },
    listRentedNumbersHandler
  );
}

export const listRentedNumbersHandler = async (
  { regionCode, type, searchPattern, patternPosition, capability, size }: {
    regionCode?: string;
    type?: 'MOBILE' | 'LOCAL' | 'TOLL_FREE' | '';
    searchPattern?: string;
    patternPosition?: 'START' | 'END' | 'CONTAINS';
    capability?: 'SMS' | 'VOICE';
    size?: number;
  }
) => {
  const projectId = process.env.PROJECT_ID;
  const keyId     = process.env.KEY_ID;
  const keySecret = process.env.KEY_SECRET;

  if (!projectId || !keyId || !keySecret) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error:'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.'
      })).promptResponse;
  }

  try {
    const queryParams = new URLSearchParams();
    if (regionCode) queryParams.append('regionCode', regionCode);
    if (type) queryParams.append('type', type);
    if (searchPattern) queryParams.append('numberPattern.pattern', searchPattern);
    if (patternPosition) queryParams.append('numberPattern.searchPattern', patternPosition);
    if (capability) queryParams.append('capability', capability);
    if (size) queryParams.append('pageSize', size.toString());

    const response = await fetch(
      `https://numbers.api.sinch.com/v1/projects/${projectId}/activeNumbers${queryParams.toString() ? '?' + queryParams.toString() : ''}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
          'User-Agent': formatUserAgent(TOOL_NAME, projectId),
        },

      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new PromptResponse(JSON.stringify({
        success: false,
        error: `(${response.status} - ${response.statusText}) Failed to list the rented numbers: ${errorText}`
      })).promptResponse;
    }

    const parsedResponse = await response.json() as Numbers.ActiveNumbersResponse;

    return new PromptResponse(JSON.stringify({
      success: true,
      data: parsedResponse.activeNumbers
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error))
    })).promptResponse;
  }


};
