import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { server } from './server';
dotenv.config();

const main = async() => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Sinch MCP Server running on stdio');
};

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
