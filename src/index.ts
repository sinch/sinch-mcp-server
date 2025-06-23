import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import {
  instantiateMcpServer,
  parseArgs,
  registerCapabilities,
  startWebhookServer,
} from './server';
dotenv.config();

export const main = async () => {
  const transport = new StdioServerTransport();
  const server = instantiateMcpServer();
  registerCapabilities(server, parseArgs(process.argv));
  await server.connect(transport);
  console.info('Sinch MCP Server running on stdio');
  // Create a webhook server to handle the webhook events
  await startWebhookServer();
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}
