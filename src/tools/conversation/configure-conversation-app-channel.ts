import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { formatAppResponse } from './utils/format-app-response';
import {
  buildChannelCredential,
  mergeChannelCredentials,
} from './utils/build-channel-credential';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import {
  ChannelEnum,
  ConversationAppIdOverride,
  ConversationRegionOverride,
} from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'configureConversationAppChannel';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerConfigureConversationAppChannel = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Configure or update a channel on an existing Conversation API app. Existing channel credentials are preserved; the specified channel is added or replaced. For SMS, provide the service plan ID and API token. The app must be in the same region as the channel resources.',
    {
      appId: ConversationAppIdOverride,
      channel: ChannelEnum,
      region: ConversationRegionOverride,
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
    },
    configureConversationAppChannelHandler
  );
};

export const configureConversationAppChannelHandler = async ({
  appId,
  channel,
  region,
  smsServicePlanId,
  smsApiToken,
  bearerToken,
  bearerClaimedIdentity,
  pageAccessToken,
  callbackSecret,
}: {
  appId?: string;
  channel: z.infer<typeof ChannelEnum>;
  region?: string;
  smsServicePlanId?: string;
  smsApiToken?: string;
  bearerToken?: string;
  bearerClaimedIdentity?: string;
  pageAccessToken?: string;
  callbackSecret?: string;
}): Promise<IPromptResponse> => {
  const maybeAppId = getConversationAppId(appId);
  if (isPromptResponse(maybeAppId)) {
    return maybeAppId.promptResponse;
  }
  const conversationAppId = maybeAppId;

  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  try {
    const existingApp = await conversationService.app.get({ app_id: conversationAppId });
    const incomingCredential = buildChannelCredential({
      channel,
      smsServicePlanId,
      smsApiToken,
      bearerToken,
      bearerClaimedIdentity,
      pageAccessToken,
      callbackSecret,
    });
    const channelCredentials = mergeChannelCredentials(
      existingApp.channel_credentials,
      incomingCredential
    );

    const response = await conversationService.app.update({
      app_id: conversationAppId,
      update_mask: ['channel_credentials'],
      appUpdateRequestBody: {
        channel_credentials: channelCredentials,
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
