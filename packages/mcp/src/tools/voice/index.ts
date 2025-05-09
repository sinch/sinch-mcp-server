import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTtsCallout } from './tts-callout.js';

export const registerVoiceTools = (server: McpServer) => {
  registerTtsCallout(server);
};
