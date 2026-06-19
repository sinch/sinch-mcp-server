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
      description: `Read before calling create-conversation-app or any set-*-channel-on-app tool. Covers the app setup flow, required credentials per channel (SMS, RCS, WhatsApp), region constraints, and how to handle ambiguous channel requests from the user.`,
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
