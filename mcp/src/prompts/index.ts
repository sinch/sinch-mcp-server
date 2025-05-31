import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppId } from './conversation/app-id';

export const registerPrompts = (server: McpServer) => {
  registerAppId(server);
}
