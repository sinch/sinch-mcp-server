import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListAllApps } from './app-list-all-apps.js';
import { registerSendLocationMessage } from './send-location-message.js';
import { registerSendMediaMessage } from './send-media-message.js';
import { registerSendTextMessage } from './send-text-message.js';

export const registerConversationTools = (server: McpServer) => {
  registerSendTextMessage(server);
  registerSendMediaMessage(server);
  registerSendLocationMessage(server);
  registerListAllApps(server);
};
