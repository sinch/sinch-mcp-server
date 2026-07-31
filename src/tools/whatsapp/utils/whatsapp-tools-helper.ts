import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => config;

export const toolsConfig = defineToolsConfig({
  listWhatsAppTemplates: {
    name: 'list-whatsapp-templates',
    tags: ['all', 'whatsapp', 'notification', 'configuration', 'list-whatsapp-templates'],
  },
  createWhatsAppTemplate: {
    name: 'create-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'create-whatsapp-template'],
  },
  updateWhatsAppTemplate: {
    name: 'update-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'update-whatsapp-template'],
  },
});

export type WhatsAppToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: WhatsAppToolKey): string => toolsConfig[toolKey].name;
