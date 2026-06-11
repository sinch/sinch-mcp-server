import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/conversation';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { formatWebhook } from './utils/format-webhook-response';
import {
  appendRegionHint,
  buildDormantTriggersWarning,
  hasNoTriggers,
} from './utils/webhook-tools-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import {
  ConversationAppIdOverride,
  ConversationRegionOverride,
  WebhookTarget,
  WebhookTriggers,
} from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: ConversationToolKey = 'createWebhook';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCreateWebhook = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Create a webhook for a Conversation app (up to 5 per app). Events are delivered to the target URL over HTTP when triggers fire. Configure the signing secret in the Sinch Dashboard; it is not set through this tool.',
      inputSchema: {
        target: WebhookTarget,
        appId: ConversationAppIdOverride,
        triggers: WebhookTriggers,
        region: ConversationRegionOverride,
      },
    },
    createWebhookHandler,
  );
};

export const createWebhookHandler = async ({
  target,
  appId,
  triggers,
  region,
}: {
  target: string;
  appId?: string;
  triggers?: Conversation.WebhookTrigger[];
  region?: string;
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

  const webhookCreateRequestBody: Conversation.CreateWebhookRequestBody = {
    app_id: conversationAppId,
    target,
    target_type: 'HTTP',
    ...(triggers !== undefined && { triggers }),
  };

  try {
    const response = await conversationService.webhooks.create({
      webhookCreateRequestBody,
    });
    const formatted = formatWebhook(response);
    return new PromptResponse(JSON.stringify({
      success: true,
      webhook: formatted,
      ...(hasNoTriggers(triggers) && formatted.id && {
        warning: buildDormantTriggersWarning(formatted.id),
      }),
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
