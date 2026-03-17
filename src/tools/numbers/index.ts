import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListAvailableRegions } from './list-available-regions';
import { registerListRentedNumbers } from './list-rented-numbers';
import { registerRentNumbers } from './rent-numbers';
import { registerSearchAvailableNumbers } from './search-for-available-numbers';
import { Tags } from '../../types';

export const registerNumbersTools = (server: McpServer, tags: Tags[]) => {
  registerListAvailableRegions(server, tags);
  registerListRentedNumbers(server, tags)
  registerRentNumbers(server, tags);
  registerSearchAvailableNumbers(server, tags)
}
