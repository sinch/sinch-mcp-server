import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { registerPrompts } from './prompts';
import { registerConversationTools } from './tools/conversation';
import { registerEmailTools } from './tools/email';
import { registerVerificationTools } from './tools/verification';
import { registerVoiceTools } from './tools/voice';
dotenv.config();

export const server = new McpServer({
  name: 'Sinch',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  }
});

// Register the prompts
registerPrompts(server);

// Register the tools
registerVerificationTools(server);
registerConversationTools(server);
registerVoiceTools(server);
registerEmailTools(server);

const main = async() => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Sinch MCP Server running on stdio');
};

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
