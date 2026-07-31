import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { formatListAllTemplatesResponse } from './utils/format-list-all-templates-response';
import { getConversationService, setTemplateRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { appendRegionHint } from './utils/region-hint';
import { ConversationRegionOverride } from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const ListMessagingTemplatesSchema = {
  region: ConversationRegionOverride,
};

type ListMessagingTemplates = z.infer<z.ZodObject<typeof ListMessagingTemplatesSchema>>;

const TOOL_KEY: ConversationToolKey = 'listMessagingTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAllTemplates = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get a list of the omni-channel messaging templates (managed by Sinch) belonging to an account, for the configured region only. Note that this list does NOT include: (1) Email templates - use the list-email-templates tool to fetch them; (2) WhatsApp channel-specific templates (managed by Meta) - use the list-whatsapp-templates tool to fetch them. If the user asks for all their messaging templates, you can propose to additionally call list-whatsapp-templates to fetch the WhatsApp-specific templates.',
      inputSchema: ListMessagingTemplatesSchema,
    },
    listAllTemplatesHandler,
  );
};

export const listAllTemplatesHandler = async ({ region }: ListMessagingTemplates): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setTemplateRegion(region, conversationService);

  try {
    const response = await conversationService.templatesV2.list({});
    const omniChannelTemplates = formatListAllTemplatesResponse(response);

    return new PromptResponse(
      JSON.stringify({
        success: true,
        region: usedRegion,
        templates: omniChannelTemplates,
        total_count: omniChannelTemplates.length,
        related_tools: {
          'list-whatsapp-templates':
            'WhatsApp channel-specific templates (managed by Meta) are not included in this list. Use the list-whatsapp-templates tool to fetch them if the user wants them.',
        },
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
