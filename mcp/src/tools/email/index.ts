import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListEmailEvents } from './list-email-events';
import { registerRetrieveEmailInfo } from './retrieve-email-info';
import { registerSendEmail } from './send-email';

export const registerEmailTools = (server: McpServer) => {
  registerSendEmail(server);
  registerRetrieveEmailInfo(server);
  registerListEmailEvents(server);
};
