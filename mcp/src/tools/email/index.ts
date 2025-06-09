import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAnalyticsMetrics } from './analytics-metrics';
import { registerListEmailEvents } from './list-email-events';
import { registerRetrieveEmailInfo } from './retrieve-email-info';
import { registerSendEmail } from './send-email';
import { Tags } from '../../types';

export const registerEmailTools = (server: McpServer, tags: Tags[]) => {
  registerSendEmail(server, tags);
  registerRetrieveEmailInfo(server, tags);
  registerListEmailEvents(server, tags);
  registerAnalyticsMetrics(server, tags);
};
