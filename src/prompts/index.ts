import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppId } from './conversation/app-id';
import { Tags } from '../types';

export const registerPrompts = (server: McpServer, tags: Tags[]) => {
  registerAppId(server, tags);
}
