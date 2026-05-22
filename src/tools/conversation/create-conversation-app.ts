import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildChannelCredential } from './utils/build-channel-credential';
import { formatAppResponse } from './utils/format-app-response';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import {
  ChannelEnum,
  ConversationRegionOverride,
} from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'createConversationApp';
const TOOL_NAME = getToolName(TOOL_KEY);

const ChannelCredentialSchema = z.object({
  channel: ChannelEnum,
  smsServicePlanId: z.string().optional()
    .describe('(SMS only) Sinch SMS service plan ID used as the static bearer claimed_identity.'),
  smsApiToken: z.string().optional()
    .describe('(SMS only) Sinch API token used as the static bearer token.'),
  bearerToken: z.string().optional()
    .describe('(WHATSAPP, RCS, VIBERBM) Bearer token for the channel integration.'),
  bearerClaimedIdentity: z.string().optional()
    .describe('(WHATSAPP, RCS, VIBERBM) Claimed identity for the static bearer credential (e.g. WhatsApp sender ID).'),
  pageAccessToken: z.string().optional()
    .describe('(MESSENGER only) Facebook page access token.'),
  callbackSecret: z.string().optional()
    .describe('(Optional) Secret used to verify channel callbacks when supported by the channel.'),
});

export const registerCreateConversationApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Create a new Conversation API app in the project. Channel credentials are optional at creation; use configure-conversation-app-channel to add or update channels later.',
    {
      displayName: z.string()
        .describe('(Required) Display name for the Conversation API app.'),
      region: ConversationRegionOverride,
      channelCredentials: z.array(ChannelCredentialSchema).optional()
        .describe('(Optional) Initial channel credentials. Defaults to an empty list.'),
    },
    createConversationAppHandler
  );
};

export const createConversationAppHandler = async ({
  displayName,
  region,
  channelCredentials,
}: {
  displayName: string;
  region?: string;
  channelCredentials?: z.infer<typeof ChannelCredentialSchema>[];
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  try {
    const credentials = (channelCredentials ?? []).map(buildChannelCredential);

    const response = await conversationService.app.create({
      appCreateRequestBody: {
        display_name: displayName,
        channel_credentials: credentials,
      },
    });

    return new PromptResponse(JSON.stringify({
      success: true,
      region: usedRegion,
      app: formatAppResponse(response),
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) + `. Are you sure you are using the right region? The current region is ${usedRegion}.`,
    })).promptResponse;
  }
};
