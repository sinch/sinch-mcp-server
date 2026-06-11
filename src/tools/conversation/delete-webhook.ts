import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { appendRegionHint } from './utils/webhook-tools-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { ConversationRegionOverride, WebhookId } from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: ConversationToolKey = 'deleteWebhook';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerDeleteWebhook = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Delete a Conversation API webhook by its ID.',
      inputSchema: {
        webhookId: WebhookId,
        region: ConversationRegionOverride,
      },
    },
    deleteWebhookHandler,
  );
};

export const deleteWebhookHandler = async ({
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
    await conversationService.webhooks.delete({
      webhook_id: webhookId,
    });
    return new PromptResponse(JSON.stringify({
      success: true,
      webhook_id: webhookId,
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
