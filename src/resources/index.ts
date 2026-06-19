import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../types';
import { registerConversationResources } from './conversation';
import { registerRcsResources } from './rcs';

export const registerResources = (server: McpServer, tags: Tags[]) => {
  registerConversationResources(server, tags);
  registerRcsResources(server, tags);
};
