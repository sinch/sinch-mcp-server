import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListAllApps } from './list-all-apps';
import { registerListAllTemplates } from './list-templates';
import { registerSendCardOrChoiceMessage } from './send-card-or-choice-message';
import { registerSendContactInfoMessage } from './send-contact-info-message';
import { registerSendLocationMessage } from './send-location-message';
import { registerSendMediaMessage } from './send-media-message';
import { registerSendTemplateMessage } from './send-template-message';
import { registerSendTextMessage } from './send-text-message';

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
