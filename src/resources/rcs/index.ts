import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../../types';
import { matchesAnyTag } from '../../utils';
import { RCS_CAMPAIGN_GUIDE_URI, rcsCampaignGuide } from './rcs-campaign-guide';

const RCS_RESOURCE_TAGS: Tags[] = [
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
  'get-rcs-test-number-state',
  'launch-rcs-sender',
];

export const registerRcsResources = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, RCS_RESOURCE_TAGS)) {
    return;
  }

  server.registerResource(
    'rcs-campaign-setup',
    RCS_CAMPAIGN_GUIDE_URI,
    {
      description: `Read before any RCS sender or channel operation (create-rcs-sender, set-rcs-channel-on-app, launch-rcs-sender). Covers the sender lifecycle states, how to connect the RCS Provisioning API to the Conversation API, which questionnaire fields are required per target country, test number caps, and async launch expectations.`,
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: RCS_CAMPAIGN_GUIDE_URI,
          mimeType: 'text/markdown',
          text: rcsCampaignGuide,
        },
      ],
    }),
  );
};
