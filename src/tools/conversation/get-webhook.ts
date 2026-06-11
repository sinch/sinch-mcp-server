import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { formatWebhook } from './utils/format-webhook-response';
import { appendRegionHint } from './utils/webhook-tools-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { ConversationRegionOverride, WebhookId } from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: ConversationToolKey = 'getWebhook';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetWebhook = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Get a Conversation API webhook by its ID. Signing secrets are not returned; configure them in the Sinch Dashboard.',
      inputSchema: {
        webhookId: WebhookId,
        region: ConversationRegionOverride,
      },
    },
    getWebhookHandler,
  );
};

export const getWebhookHandler = async ({
  webhookId,
  region,
}: {
  webhookId: string;
  region?: string;
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  try {
    const response = await conversationService.webhooks.get({
      webhook_id: webhookId,
    });
    return new PromptResponse(JSON.stringify({
      success: true,
      webhook: formatWebhook(response),
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
