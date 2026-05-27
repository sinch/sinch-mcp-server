import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { formatListWebhooksResponse } from './utils/format-webhook-response';
import { appendRegionHint } from './utils/webhook-tools-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { ConversationAppIdOverride, ConversationRegionOverride } from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: ConversationToolKey = 'listWebhooks';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListWebhooks = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'List all webhooks configured for a Conversation app. Webhooks receive Conversation API callbacks at a target URL when selected triggers occur. Configure signing secrets in the Sinch Dashboard.',
    {
      appId: ConversationAppIdOverride,
      region: ConversationRegionOverride,
    },
    listWebhooksHandler,
  );
};

export const listWebhooksHandler = async ({
  appId,
  region,
}: {
  appId?: string;
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

  try {
    const response = await conversationService.webhooks.list({
      app_id: conversationAppId,
    });
    const formatted = formatListWebhooksResponse(response);
    return new PromptResponse(JSON.stringify({
      success: true,
      ...formatted,
      total_count: formatted.webhooks.length,
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
