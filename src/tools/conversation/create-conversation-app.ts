import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import {
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { formatAppResponse } from './utils/format-app-response';
import { appendRegionHint } from './utils/app-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { ConversationRegionOverride } from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'createConversationApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCreateConversationApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Create a new Conversation API app in the project. No channels are configured at creation; use add-sms-channel-to-app, add-rcs-channel-to-app, or add-whatsapp-channel-to-app to add channels later.',
    {
      displayName: z.string()
        .describe('(Required) Display name for the Conversation API app.'),
      region: ConversationRegionOverride,
    },
    createConversationAppHandler,
  );
};

export const createConversationAppHandler = async ({
  displayName,
  region,
}: {
  displayName: string;
  region?: string;
}): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  try {
    const response = await conversationService.app.create({
      appCreateRequestBody: {
        display_name: displayName,
        channel_credentials: [],
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
      error: appendRegionHint(error, usedRegion),
    })).promptResponse;
  }
};
