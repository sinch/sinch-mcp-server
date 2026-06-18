import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../../types';
import { matchesAnyTag } from '../../../utils';
import { RCS_SETUP_URI, rcsSetupGuide } from './rcs-setup-guide';

const RESOURCE_TAGS: Tags[] = [
  'all',
  'rcs',
  'configuration',
  'list-rcs-senders',
  'get-rcs-sender',
  'create-rcs-sender',
  'update-rcs-sender',
  'add-rcs-test-number',
  'delete-rcs-test-number',
  'resend-rcs-test-number-invite',
  'get-rcs-number-capabilities',
  'get-rcs-test-number-states',
  'launch-rcs-sender',
];

export const registerRcsResources = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, RESOURCE_TAGS)) {
    return;
  }

  server.registerResource(
    'rcs-setup-guide',
    RCS_SETUP_URI,
    {
      description: 'RCS sender provisioning workflows: create, test, launch, and connect to Conversation API.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: RCS_SETUP_URI,
          mimeType: 'text/markdown',
          text: rcsSetupGuide,
        },
      ],
    }),
  );
};
