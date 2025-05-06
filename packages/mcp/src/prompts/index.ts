import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppId } from './conversation/app-id.js';

export const registerPrompts = (server: McpServer) => {
  registerAppId(server);
}
