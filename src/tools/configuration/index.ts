import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpConfiguration } from './tools-configuration';

export const registerConfigurationTools = (server: McpServer) => {
  registerMcpConfiguration(server);
};
