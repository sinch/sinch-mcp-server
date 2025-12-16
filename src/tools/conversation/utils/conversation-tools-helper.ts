import { matchesAnyTag } from '../../../utils';
import { ENABLED, toolsStatusMap } from '../../../tools-config';
import { ToolsConfig } from '../../../types';

const defineToolsConfig = <T extends Record<string, ToolsConfig>>(config: T) => {
  return config;
}

const toolsConfig = defineToolsConfig({
  listConversationApps: {
    name: 'list-conversation-apps',
    tags: ['all', 'conversation', 'notification', 'list-conversation-apps'],
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
  sendTextMessage: {
    name: 'send-text-message',
    tags: ['all', 'conversation', 'notification', 'send-text-message'],
  }
});

export type ConversationToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: ConversationToolKey): string => toolsConfig[toolKey].name;

export const shouldRegisterTool = (toolKey: ConversationToolKey, tags: string[]): boolean => {
  const filteringTags = toolsConfig[toolKey].tags;
  const toolName = toolsConfig[toolKey].name;
  if (!matchesAnyTag(filteringTags, tags)) {
    toolsStatusMap[toolName] = `The filtering tags don't contain ${filteringTags.join(' or ')}`;
    return false;
  }
  if (getMissingEnvironmentVariables().length > 0) {
    toolsStatusMap[toolName] = `Incorrect configuration. The environment variables are not set: ${getMissingEnvironmentVariables().join(', ')}`;
    return false;
  }
  toolsStatusMap[toolName] = ENABLED;
  return true;
}

export const getMissingEnvironmentVariables = () => {
  const requiredEnvVars = [
    'CONVERSATION_PROJECT_ID',
    'CONVERSATION_KEY_ID',
    'CONVERSATION_KEY_SECRET',
  ];
  return requiredEnvVars.filter((envVar) => !process.env[envVar]);
}
