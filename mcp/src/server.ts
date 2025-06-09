import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from './prompts';
import { registerVerificationTools } from './tools/verification';
import { registerConversationTools } from './tools/conversation';
import { registerVoiceTools } from './tools/voice';
import { registerEmailTools } from './tools/email';
import { Tags } from './types';

export const server = new McpServer({
  name: 'Sinch',
  version: '0.0.1-alpha.0',
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  }
});

export const parseArgs = (args: string[]): Tags[] => {
  const args1 = args.slice(2);
  return args1.includes('--tags')
      ? args1[args1.indexOf('--tags') + 1].split(',')
      : [];
}

export const registerCapabilities = (server: McpServer, tags: Tags[]) => {
  if ( tags.length === 0) tags.push('all')

  // Register the prompts
  registerPrompts(server, tags);

  // Register the tools
  registerVerificationTools(server, tags);
  registerConversationTools(server, tags);
  registerVoiceTools(server, tags);
  registerEmailTools(server, tags);
}

registerCapabilities(server, parseArgs(process.argv));
