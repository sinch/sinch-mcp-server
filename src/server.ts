import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { registerVerificationTools } from './tools/verification';
import { registerConversationTools } from './tools/conversation';
import { registerVoiceTools } from './tools/voice';
import { registerEmailTools } from './tools/email';
import { registerNumbersTools } from './tools/numbers';
import { registerRcsTools } from './tools/rcs';
import { registerWhatsAppTools } from './tools/whatsapp';
import { Tags } from './types';
import { env } from './env';
import pkg from '../package.json';
const mcpServerVersion = pkg.version;

export const instantiateMcpServer = () => {
  return new McpServer({
    name: 'Sinch',
    version: mcpServerVersion,
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  });
};

const parseTagList = (tagList: string | undefined): Tags[] => {
  return tagList ? tagList.split(',') : [];
};

export const getToolsFilter = (args: string[]): Tags[] => {
  const args1 = args.slice(2);
  if (args1.includes('--tags')) {
    return parseTagList(args1[args1.indexOf('--tags') + 1]);
  }
  return parseTagList(env.MCP_TAGS);
};

export const registerCapabilities = (server: McpServer, tags: Tags[]) => {
  if (tags.length === 0) {
    tags.push('all');
  }

  // Register the prompts
  registerPrompts(server, tags);

  // Register the resources
  registerResources(server, tags);

  // Register the tools
  registerVerificationTools(server, tags);
  registerConversationTools(server, tags);
  registerVoiceTools(server, tags);
  registerEmailTools(server, tags);
  registerNumbersTools(server, tags);
  registerRcsTools(server, tags);
  registerWhatsAppTools(server, tags);
};
