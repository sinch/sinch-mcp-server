import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveSinchOAuthCredentials } from '../../auth/sinch-oauth-credentials';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { formatListAllTemplatesResponse } from './utils/format-list-all-templates-response';
import { getConversationService, setTemplateRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { SupportedConversationRegion } from '@sinch/sdk-client';

const TOOL_KEY: ConversationToolKey = 'listMessagingTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAllTemplates = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  server.registerTool(
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

  const maybeCredentials = resolveSinchOAuthCredentials();
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const { projectId, keyId, keySecret } = maybeCredentials;

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

    const whatsAppTemplates = await fetchWhatsAppSpecificTemplates(projectId, keyId, keySecret);

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

interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  state: string;
}

interface WhatsAppTemplatesResponse {
  templates: WhatsAppTemplate[];
}

const fetchWhatsAppSpecificTemplates = async (
  projectId: string,
  keyId: string,
  keySecret: string,
) => {
  const resp = await fetch(`https://provisioning.api.sinch.com/v1/projects/${projectId}/whatsapp/templates`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
    },
  });

  if (!resp.ok) {
    console.error(`Failed to fetch WhatsApp templates: ${resp.status} ${resp.statusText}`);
    return [];
  }

  const data = (await resp.json()) as WhatsAppTemplatesResponse;

  return data.templates.map((template) => ({
    channel: 'WhatsApp' as const,
    name: template.name,
    language: template.language,
    category: template.category,
    state: template.state,
  }));
};
