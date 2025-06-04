import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListAllApps } from './list-all-apps';
import { registerListAllTemplates } from './list-templates';
import { registerSendCardOrChoiceMessage } from './send-card-or-choice-message';
import { registerSendContactInfoMessage } from './send-contact-info-message';
import { registerSendLocationMessage } from './send-location-message';
import { registerSendMediaMessage } from './send-media-message';
import { registerSendTemplateMessage } from './send-template-message';
import { registerSendTextMessage } from './send-text-message';
import { Tags } from '../../types';

export const registerConversationTools = (server: McpServer, tags: Tags[]) => {
  registerSendTextMessage(server, tags);
  registerSendMediaMessage(server, tags);
  registerSendLocationMessage(server, tags);
  registerSendCardOrChoiceMessage(server, tags);
  registerSendContactInfoMessage(server, tags);
  registerSendTemplateMessage(server, tags);
  registerListAllApps(server, tags);
  registerListAllTemplates(server, tags);
};
