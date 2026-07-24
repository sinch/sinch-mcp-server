import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getConversationService, setConversationRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { formatAppResponse } from './utils/format-app-response';
import { appendRegionHint } from './utils/region-hint';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { ConversationAppId, ConversationRegionOverride } from './prompt-schemas';

const UpdateConversationAppSchema = {
  appId: ConversationAppId,
  displayName: z.string().describe('New display name for the Conversation API app.'),
  region: ConversationRegionOverride,
};

type UpdateConversationApp = z.infer<z.ZodObject<typeof UpdateConversationAppSchema>>;

const TOOL_KEY: ConversationToolKey = 'updateConversationApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerUpdateConversationApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Update a Conversation API app display name. To configure or replace channel credentials, use set-sms-channel-on-app, set-rcs-channel-on-app, or set-whatsapp-channel-on-app instead.',
      inputSchema: UpdateConversationAppSchema,
    },
    updateConversationAppHandler,
  );
};

export const updateConversationAppHandler = async ({
  appId,
  displayName,
  region,
}: UpdateConversationApp): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  try {
    const response = await conversationService.app.update({
      app_id: appId,
      appUpdateRequestBody: {
        display_name: displayName,
      },
    });

    return new PromptResponse(
      JSON.stringify({
        success: true,
        app: formatAppResponse(response),
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
