import { ToolsConfig } from '../../../types';
import { matchesAnyTag } from '../../../utils';
import { ENABLED, toolsStatusMap } from '../../../tools-config';
import { getMailgunApiKey } from './mailgun-service-helper';

const toolsConfig: Record<string, ToolsConfig> = {
  analyticsMetrics: {
    name: 'analytics-metrics',
    tags: ['all', 'email', 'analytics-metrics'],
  } ,
  listEmailEvents:{
    name: 'list-email-events',
    tags: ['all', 'email', 'list-email-events'],
  },
  listEmailTemplates: {
    name: 'list-email-templates',
    tags: ['all', 'email', 'notification', 'list-email-templates'],
  },
  retrieveEmailInfo: {
    name: 'retrieve-email-info',
    tags: ['all', 'email', 'notification', 'retrieve-email-info'],
  },
  sendEmail: {
    name: 'send-email',
    tags: ['all', 'email', 'notification', 'send-email'],
  }
}

export type EmailToolKey = keyof typeof toolsConfig;

export const getToolName = (toolKey: EmailToolKey): string => toolsConfig[toolKey].name;

export const shouldRegisterTool = (toolKey: string, tags: string[]): boolean => {
  const filteringTags = toolsConfig[toolKey].tags;
  const toolName = toolsConfig[toolKey].name;
  if (!matchesAnyTag(filteringTags, tags)) {
    toolsStatusMap[toolName] = `The filtering tags don't contain ${filteringTags.join(' or ')}`;
    return false;
  }
  if (typeof getMailgunApiKey() !== 'string') {
    toolsStatusMap[toolName] = `Incorrect configuration. The environment variable "MAILGUN_API_KEY" is not set.`;
    return false;
  }
  toolsStatusMap[toolName] = ENABLED;
  return true;
}
