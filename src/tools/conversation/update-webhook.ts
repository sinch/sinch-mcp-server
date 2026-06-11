import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/conversation';
import {
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
  ConversationRegionOverride,
  WebhookId,
  WebhookTargetOptional,
  WebhookTriggers,
} from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: ConversationToolKey = 'updateWebhook';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerUpdateWebhook = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Update an existing Conversation API webhook. Provide at least one of target or triggers. Signing secrets are configured in the Sinch Dashboard, not through this tool.',
      inputSchema: {
        webhookId: WebhookId,
        target: WebhookTargetOptional,
        triggers: WebhookTriggers,
        region: ConversationRegionOverride,
      },
    },
    updateWebhookHandler,
  );
};

export const updateWebhookHandler = async ({
  webhookId,
  target,
  triggers,
  region,
}: {
  webhookId: string;
  target?: string;
  triggers?: Conversation.WebhookTrigger[];
  region?: string;
}): Promise<IPromptResponse> => {
  if (target === undefined && triggers === undefined) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: 'At least one of target or triggers must be provided to update a webhook.',
    })).promptResponse;
  }

  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const webhookUpdateRequestBody = {
    ...(target !== undefined && { target }),
    ...(triggers !== undefined && { triggers }),
  } as Conversation.UpdateWebhookRequestBody;
  try {
    const response = await conversationService.webhooks.update({
      webhook_id: webhookId,
      webhookUpdateRequestBody,
    });
    return new PromptResponse(JSON.stringify({
      success: true,
      webhook: formatWebhook(response),
      ...(triggers !== undefined && hasNoTriggers(triggers) && {
        warning: buildDormantTriggersWarning(webhookId),
      }),
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
