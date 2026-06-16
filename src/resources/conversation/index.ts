import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { CONVERSATION_APP_SETUP_URI, conversationAppSetupGuide } from './conversation-app-setup-guide';

const CONVERSATION_RESOURCE_TAGS: Tags[] = [
  'all',
  'conversation',
  'configuration',
  'create-conversation-app',
  'set-sms-channel-on-app',
  'set-rcs-channel-on-app',
  'set-whatsapp-channel-on-app',
];

export const registerConversationResources = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, CONVERSATION_RESOURCE_TAGS)) {
    return;
  }

  server.registerResource(
    'conversation-app-setup',
    CONVERSATION_APP_SETUP_URI,
    {
      description: 'How to create a Conversation API app and configure SMS, RCS, or WhatsApp channels.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: CONVERSATION_APP_SETUP_URI,
          mimeType: 'text/markdown',
          text: conversationAppSetupGuide,
        },
      ],
    }),
  );
};
