import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => config;

export const toolsConfig = defineToolsConfig({
  createWhatsAppTemplate: {
    name: 'create-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'create-whatsapp-template'],
  },
  updateWhatsAppTemplate: {
    name: 'update-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'update-whatsapp-template'],
  },
  deleteWhatsAppTemplate: {
    name: 'delete-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'delete-whatsapp-template'],
  },
  deleteWhatsAppTemplateByName: {
    name: 'delete-whatsapp-template-by-name',
    tags: ['all', 'whatsapp', 'configuration', 'delete-whatsapp-template-by-name'],
  },
});

export type WhatsAppToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: WhatsAppToolKey): string => toolsConfig[toolKey].name;
