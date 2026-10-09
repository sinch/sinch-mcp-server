import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetActiveNumberConfiguration } from './get-active-number-configuration';
import { registerListAvailableRegions } from './list-available-regions';
import { registerListRentedNumbers } from './list-rented-numbers';
import { registerRentNumbers } from './rent-numbers';
import { registerReleaseRentedNumber } from './release-rented-number';
import { registerSearchAvailableNumbers } from './search-for-available-numbers';
import { Tags } from '../../types';

export const registerNumbersTools = (server: McpServer, tags: Tags[]) => {
  registerGetActiveNumberConfiguration(server, tags);
  registerListAvailableRegions(server, tags);
  registerListRentedNumbers(server, tags);
  registerRentNumbers(server, tags);
  registerReleaseRentedNumber(server, tags);
  registerSearchAvailableNumbers(server, tags);
};
