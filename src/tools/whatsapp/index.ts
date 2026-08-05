import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../types';
import { registerCreateWhatsAppTemplate } from './create-whatsapp-template';
import { registerDeleteAllWhatsAppTemplateVariants } from './delete-all-whatsapp-template-variants';
import { registerDeleteSingleWhatsAppTemplateVariant } from './delete-single-whatsapp-template-variant';
import { registerUpdateWhatsAppTemplate } from './update-whatsapp-template';

export const registerWhatsAppTools = (server: McpServer, tags: Tags[]) => {
  registerCreateWhatsAppTemplate(server, tags);
  registerUpdateWhatsAppTemplate(server, tags);
  registerDeleteSingleWhatsAppTemplateVariant(server, tags);
  registerDeleteAllWhatsAppTemplateVariants(server, tags);
};
