import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRetrieveEmailContent } from './retrieve-email-content.js';
import { registerSendEmail } from './send-email.js';

export const registerEmailTools = (server: McpServer) => {
  registerSendEmail(server);
  registerRetrieveEmailContent(server);
};
