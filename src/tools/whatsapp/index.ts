import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../types';
import { registerCreateWhatsAppTemplate } from './create-whatsapp-template';

export const registerWhatsAppTools = (server: McpServer, tags: Tags[]) => {
  registerCreateWhatsAppTemplate(server, tags);
};
