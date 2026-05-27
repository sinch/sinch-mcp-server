import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => {
  return config;
}

export const toolsConfig = defineToolsConfig({
  listConversationApps: {
    name: 'list-conversation-apps',
    tags: ['all', 'conversation', 'notification', 'list-conversation-apps'],
  },
  createConversationApp: {
    name: 'create-conversation-app',
    tags: ['all', 'conversation', 'configuration', 'create-conversation-app'],
  },
  setSmsChannelOnApp: {
    name: 'set-sms-channel-on-app',
    tags: ['all', 'conversation', 'configuration', 'set-sms-channel-on-app'],
  },
  setRcsChannelOnApp: {
    name: 'set-rcs-channel-on-app',
    tags: ['all', 'conversation', 'configuration', 'set-rcs-channel-on-app'],
  },
  setWhatsAppChannelOnApp: {
    name: 'set-whatsapp-channel-on-app',
    tags: ['all', 'conversation', 'configuration', 'set-whatsapp-channel-on-app'],
  },
  listMessagingTemplates: {
    name: 'list-messaging-templates',
    tags: ['all', 'conversation', 'notification', 'list-messaging-templates'],
  },
  sendCardOrChoiceMessage: {
    name: 'send-choice-message',
    tags: ['all', 'conversation', 'notification', 'send-choice-message'],
  },
  sendLocationMessage: {
    name: 'send-location-message',
    tags: ['all', 'conversation', 'notification', 'send-location-message'],
  },
  sendMediaMessage: {
    name: 'send-media-message',
    tags: ['all', 'conversation', 'notification', 'send-media-message'],
  },
  sendTemplateMessage: {
    name: 'send-template-message',
    tags: ['all', 'conversation', 'notification', 'send-template-message'],
  },
  sendWhatsAppTemplateMessage: {
    name: 'send-whatsapp-template-message',
    tags: ['all', 'conversation', 'notification', 'send-whatsapp-template-message'],
  },
  sendTextMessage: {
    name: 'send-text-message',
    tags: ['all', 'conversation', 'notification', 'send-text-message'],
  },
  listWebhooks: {
    name: 'list-webhooks',
    tags: ['all', 'conversation', 'notification', 'list-webhooks'],
  },
  getWebhook: {
    name: 'get-webhook',
    tags: ['all', 'conversation', 'notification', 'get-webhook'],
  },
  createWebhook: {
    name: 'create-webhook',
    tags: ['all', 'conversation', 'notification', 'create-webhook'],
  },
  updateWebhook: {
    name: 'update-webhook',
    tags: ['all', 'conversation', 'notification', 'update-webhook'],
  },
  deleteWebhook: {
    name: 'delete-webhook',
    tags: ['all', 'conversation', 'notification', 'delete-webhook'],
  },
});

export type ConversationToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: ConversationToolKey): string => toolsConfig[toolKey].name;
