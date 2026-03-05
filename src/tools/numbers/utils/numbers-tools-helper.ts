import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => {
  return config;
}

export const toolsConfig = defineToolsConfig({
  listAvailableRegions: {
    name: 'list-available-regions',
    tags: ['all', 'numbers', 'list-available-regions'],
  },
  listRentedNumbers: {
    name: 'list-rented-numbers',
    tags: ['all', 'numbers', 'list-rented-numbers'],
  },
  rentNumbers: {
    name: 'rent-sinch-virtual-numbers',
    tags: ['all', 'numbers', 'rent-sinch-virtual-numbers'],
  },
  searchForAvailableNumbers: {
    name: 'search-for-available-numbers',
    tags: ['all', 'numbers', 'search-for-available-numbers'],
  }
});

export type NumbersToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: NumbersToolKey): string => toolsConfig[toolKey].name;
