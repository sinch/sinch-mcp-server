import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { getConversationService, setConversationRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { formatAppResponse } from './utils/format-app-response';
import { appendRegionHint } from './utils/region-hint';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { ConversationRegionOverride } from './prompt-schemas';

const CreateConversationAppSchema = {
  displayName: z.string().describe('Display name for the Conversation API app.'),
  region: ConversationRegionOverride,
};

type CreateConversationApp = z.infer<z.ZodObject<typeof CreateConversationAppSchema>>;

const TOOL_KEY: ConversationToolKey = 'createConversationApp';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerCreateConversationApp = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Create a new Conversation API app in the project. No channels are configured at creation; use set-sms-channel-on-app, set-rcs-channel-on-app, or set-whatsapp-channel-on-app to configure channels later. Read the conversation-app-setup resource for the full flow.',
      inputSchema: CreateConversationAppSchema,
    },
    createConversationAppHandler,
  );
};

export const createConversationAppHandler = async ({
  displayName,
  region,
}: CreateConversationApp): Promise<IPromptResponse> => {
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
