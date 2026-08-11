import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../types';
import { registerCreateWhatsAppTemplate } from './create-whatsapp-template';
import { registerDeleteAllWhatsAppTemplateLanguages } from './delete-all-whatsapp-template-languages';
import { registerDeleteSingleWhatsAppTemplateLanguage } from './delete-single-whatsapp-template-language';
import { registerListWhatsAppTemplates } from './list-whatsapp-templates';
import { registerUpdateWhatsAppTemplate } from './update-whatsapp-template';

export const registerWhatsAppTools = (server: McpServer, tags: Tags[]) => {
  registerListWhatsAppTemplates(server, tags);
  registerCreateWhatsAppTemplate(server, tags);
  registerUpdateWhatsAppTemplate(server, tags);
  registerDeleteSingleWhatsAppTemplateLanguage(server, tags);
  registerDeleteAllWhatsAppTemplateLanguages(server, tags);
};
