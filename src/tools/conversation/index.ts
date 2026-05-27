import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAddRcsChannelToApp } from './add-rcs-channel-to-app';
import { registerAddSmsChannelToApp } from './add-sms-channel-to-app';
import { registerAddWhatsAppChannelToApp } from './add-whatsapp-channel-to-app';
import { registerCreateConversationApp } from './create-conversation-app';
import { registerListAllApps } from './list-all-apps';
import { registerListAllTemplates } from './list-messaging-templates';
import { registerSendCardOrChoiceMessage } from './send-card-or-choice-message';
import { registerSendLocationMessage } from './send-location-message';
import { registerSendMediaMessage } from './send-media-message';
import { registerSendTemplateMessage } from './send-template-message';
import { registerSendWhatsAppTemplateMessage } from './send-whatsapp-template-message';
import { registerSendTextMessage } from './send-text-message';
import { Tags } from '../../types';

export const registerConversationTools = (server: McpServer, tags: Tags[]) => {
  registerSendTextMessage(server, tags);
  registerSendMediaMessage(server, tags);
  registerSendLocationMessage(server, tags);
  registerSendCardOrChoiceMessage(server, tags);
  registerSendTemplateMessage(server, tags);
  registerSendWhatsAppTemplateMessage(server, tags);
  registerListAllApps(server, tags);
  registerCreateConversationApp(server, tags);
  registerAddSmsChannelToApp(server, tags);
  registerAddRcsChannelToApp(server, tags);
  registerAddWhatsAppChannelToApp(server, tags);
  registerListAllTemplates(server, tags);
};
