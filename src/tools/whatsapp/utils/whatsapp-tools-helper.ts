import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => config;

export const toolsConfig = defineToolsConfig({
  listWhatsAppTemplates: {
    name: 'list-whatsapp-templates',
    tags: ['all', 'whatsapp', 'configuration', 'list-whatsapp-templates'],
  },
  createWhatsAppTemplate: {
    name: 'create-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'create-whatsapp-template'],
  },
  updateWhatsAppTemplate: {
    name: 'update-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'update-whatsapp-template'],
  },
  deleteSingleWhatsAppTemplateLanguage: {
    name: 'delete-single-whatsapp-template-language',
    tags: ['all', 'whatsapp', 'configuration', 'delete-single-whatsapp-template-language'],
  },
  deleteAllWhatsAppTemplateLanguages: {
    name: 'delete-all-whatsapp-template-languages',
    tags: ['all', 'whatsapp', 'configuration', 'delete-all-whatsapp-template-languages'],
  },
});

export type WhatsAppToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: WhatsAppToolKey): string => toolsConfig[toolKey].name;
