import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { logger } from '../../telemetry/logger';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { formatListAllTemplatesResponse } from './utils/format-list-all-templates-response';
import { getConversationService, setTemplateRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { getWhatsAppProvisioningClient } from '../whatsapp/utils/whatsapp-service-helper';
import { formatWhatsAppError } from '../whatsapp/utils/whatsapp-error-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { SupportedConversationRegion } from '@sinch/sdk-client';

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
        'Get a list of all messaging-related templates (omni-channel or channel specific) belonging to an account. Note that the Email templates are NOT included in this list - they can be found with another tool: list-email-templates. Do not try to use this tool to list Email templates, it will not work.',
    },
    listAllTemplatesHandler,
  );
};

export const listAllTemplatesHandler = async (): Promise<IPromptResponse> => {
  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;

  try {
    const supportedRegions = Object.values(SupportedConversationRegion);
    const omniChannelTemplates: any[] = [];
    const errors: { region: string; error: string }[] = [];

    for (const region of supportedRegions) {
      try {
        setTemplateRegion(region, conversationService);
        const response = await conversationService.templatesV2.list({});
        const formatted = formatListAllTemplatesResponse(response);
        omniChannelTemplates.push(...formatted.map((t) => ({ ...t, region })));
      } catch (error) {
        errors.push({
          region,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const whatsAppTemplates = await fetchWhatsAppSpecificTemplates(errors);

    return new PromptResponse(
      JSON.stringify({
        success: errors.length === 0,
        templates: {
          omni_channel: omniChannelTemplates,
          whatsapp: whatsAppTemplates,
          ...(errors.length > 0 && { errors }),
        },
        total_count: omniChannelTemplates.length + whatsAppTemplates.length,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    ).promptResponse;
  }
};

const fetchWhatsAppSpecificTemplates = async (errors: { region: string; error: string }[]) => {
  const maybeClient = getWhatsAppProvisioningClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    const error = maybeClient.promptResponse.content.map((c) => c.text).join(' ');
    logger.error({ error }, 'Failed to resolve WhatsApp credentials');
    errors.push({ region: 'whatsapp', error });
    return [];
  }

  try {
    const { templates } = await maybeClient.listTemplates();

    return templates.map((template) => ({
      channel: 'WhatsApp' as const,
      name: template.name,
      language: template.language,
      category: template.category,
      state: template.state,
    }));
  } catch (error) {
    const formattedError = formatWhatsAppError(error);
    logger.error({ error: formattedError }, 'Failed to fetch WhatsApp templates');
    errors.push({ region: 'whatsapp', error: formattedError });
    return [];
  }
};
