import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from './prompts';
import { registerVerificationTools } from './tools/verification';
import { registerConversationTools } from './tools/conversation';
import { registerVoiceTools } from './tools/voice';
import { registerEmailTools } from './tools/email';

export const server = new McpServer({
  name: 'Sinch',
  version: '0.0.1-alpha.0',
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
