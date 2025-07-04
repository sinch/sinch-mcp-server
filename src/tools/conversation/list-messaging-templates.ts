import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse } from '../../utils';
import {
  formatChannelSpecificTemplates,
  formatOmniChannelTemplates,
  renderInstructions,
} from './utils/format-list-all-templates-response';
import { getConversationTemplateClient } from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: ConversationToolKey = 'listMessagingTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListAllTemplates = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Get a list of all messaging-related templates (omni-channel or channel specific) belonging to an account. Note that the Email templates are NOT included in this list - they can be found with another tool: list-email-templates. Do not try to use this tool to list Email templates, it will not work.',
    listAllTemplatesHandler
  );
};

export const listAllTemplatesHandler = async (): Promise<IPromptResponse> => {
  const maybeClient = getConversationTemplateClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const sinchClient = maybeClient;

  const responseUS = await sinchClient.conversation.templatesV2.list({});

  sinchClient.conversation.setRegion('eu');
  const responseEU = await sinchClient.conversation.templatesV2.list({});

  sinchClient.conversation.setRegion('br');
  const responseBR = await sinchClient.conversation.templatesV2.list({});

  const replyParts = [];
  replyParts.push(formatOmniChannelTemplates(responseUS, responseEU, responseBR));
  const whatsAppTemplates = await fetchWhatsAppSpecificTemplates();
  replyParts.push(formatChannelSpecificTemplates(whatsAppTemplates));
  replyParts.push(renderInstructions.trim());

  return new PromptResponse(replyParts.join('\n\n')).promptResponse;
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
    `https://provisioning.api.sinch.com/v1/projects/${process.env.CONVERSATION_PROJECT_ID}/whatsapp/templates`,
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
