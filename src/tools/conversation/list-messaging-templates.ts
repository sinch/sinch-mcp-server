import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { formatListAllTemplatesResponse } from './utils/format-list-all-templates-response';
import { getConversationTemplateService, setTemplateRegion } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: ConversationToolKey = 'listMessagingTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAllTemplates = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Get a list of all messaging-related templates (omni-channel or channel specific) belonging to an account. Note that the Email templates are NOT included in this list - they can be found with another tool: list-email-templates. Do not try to use this tool to list Email templates, it will not work.',
    listAllTemplatesHandler
  );
};

export const listAllTemplatesHandler = async (): Promise<IPromptResponse> => {
  const maybeService = getConversationTemplateService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;

  try {
    setTemplateRegion('us', conversationService);
    const responseUS = await conversationService.templatesV2.list({});

    setTemplateRegion('eu', conversationService);
    const responseEU = await conversationService.templatesV2.list({});

    setTemplateRegion('br', conversationService);
    const responseBR = await conversationService.templatesV2.list({});

    const whatsAppTemplates = await fetchWhatsAppSpecificTemplates();

    const omniChannelTemplates = [
      ...formatListAllTemplatesResponse(responseUS).map(t => ({ ...t, region: 'us' })),
      ...formatListAllTemplatesResponse(responseEU).map(t => ({ ...t, region: 'eu' })),
      ...formatListAllTemplatesResponse(responseBR).map(t => ({ ...t, region: 'br' }))
    ];

    return new PromptResponse(JSON.stringify({
      templates: {
        omni_channel: omniChannelTemplates,
        whatsapp: whatsAppTemplates
      },
      total_count: omniChannelTemplates.length + whatsAppTemplates.length
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
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

const fetchWhatsAppSpecificTemplates = async () => {
  const resp = await fetch(
    `https://provisioning.api.sinch.com/v1/projects/${process.env.PROJECT_ID}/whatsapp/templates`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${process.env.CONVERSATION_KEY_ID}:${process.env.CONVERSATION_KEY_SECRET}`).toString('base64')
      }
    }
  );

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
