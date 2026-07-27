import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => config;

export const toolsConfig = defineToolsConfig({
  createWhatsAppTemplate: {
    name: 'create-whatsapp-template',
    tags: ['all', 'whatsapp', 'configuration', 'create-whatsapp-template'],
  },
});

export type WhatsAppToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: WhatsAppToolKey): string => toolsConfig[toolKey].name;
