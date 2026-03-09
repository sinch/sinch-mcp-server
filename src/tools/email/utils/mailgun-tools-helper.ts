import { ToolsConfig } from '../../../types';
import crypto from 'crypto';

export const toolsConfig: Record<string, ToolsConfig> = {
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

export const sha256 = (str: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}
