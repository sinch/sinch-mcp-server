import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse } from '../../types';
import { ENABLED, toolsStatusMap } from '../../tools-config';

const TOOL_NAME = 'sinch-mcp-configuration';

export const registerMcpConfiguration = (server: McpServer) => {
  toolsStatusMap[TOOL_NAME] = ENABLED;
  server.tool(
    TOOL_NAME,
    'This tool allows you to retrieve the configuration of the Sinch MCP server. It provides information about which tools are enabled and disabled with some troubleshooting information about why a tool would be disabled.',
    mcpConfigurationHandler
  );
};

export const mcpConfigurationHandler = (): IPromptResponse => {
  let result = 'Here is the status of the Sinch MCP server tools. They must be displayed as a array, the enabled tools first with the status ✅, the disabled tools after, with the description of why they are disabled.\n\n';
  result += '| Tool Name | Status | Description |\n';
  result += '|-----------|--------|-------------|\n';
  for (const tool of Object.keys(toolsStatusMap)) {
    const status = toolsStatusMap[tool];
    if (status === ENABLED) {
      result += `| ${tool} | ✅ | Enabled |\n`;
    } else {
      result += `| ${tool} | ❌ | ${status} |\n`;
    }
  }
  return new PromptResponse(result).promptResponse;
}
