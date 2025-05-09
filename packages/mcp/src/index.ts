import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { registerPrompts } from './prompts/index.js';
import { registerConversationTools } from './tools/conversation/index.js';
import { registerVerificationTools } from './tools/verification/index.js';
import { registerVoiceTools } from './tools/voice/index.js';
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

const main = async() => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Sinch MCP Server running on stdio');
};

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
