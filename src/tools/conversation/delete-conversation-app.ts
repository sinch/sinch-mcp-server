import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getConversationService, setConversationRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { appendRegionHint } from './utils/region-hint';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { ConversationAppId, ConversationRegionOverride } from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'deleteConversationApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerDeleteConversationApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Delete a Conversation API app by its ID. This permanently removes the app and its channel configuration.',
      inputSchema: {
        appId: ConversationAppId,
        region: ConversationRegionOverride,
      },
    },
    deleteConversationAppHandler,
  );
};

export const deleteConversationAppHandler = async ({
  appId,
  region,
}: {
  appId: string;
  region?: string;
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  try {
    await conversationService.app.delete({
      app_id: appId,
    });
    return new PromptResponse(
      JSON.stringify({
        success: true,
        app_id: appId,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: appendRegionHint(error, usedRegion),
      }),
    ).promptResponse;
  }
};
