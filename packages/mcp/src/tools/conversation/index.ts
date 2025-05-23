import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListAllApps } from './app-list-all-apps.js';
import { registerListAllTemplates } from './list-templates.js';
import { registerSendCardOrChoiceMessage } from './send-card-or-choice-message.js';
import { registerSendContactInfoMessage } from './send-contact-info-message.js';
import { registerSendLocationMessage } from './send-location-message.js';
import { registerSendMediaMessage } from './send-media-message.js';
import { registerSendTemplateMessage } from './send-template-message.js';
import { registerSendTextMessage } from './send-text-message.js';

export const registerConversationTools = (server: McpServer) => {
  registerSendTextMessage(server);
  registerSendMediaMessage(server);
  registerSendLocationMessage(server);
  registerSendCardOrChoiceMessage(server);
  registerSendContactInfoMessage(server);
  registerSendTemplateMessage(server);
  registerListAllApps(server);
  registerListAllTemplates(server);
};
