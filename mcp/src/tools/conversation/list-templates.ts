import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse } from '../../utils';
import {
  formatChannelSpecificTemplates,
  formatOmniChannelTemplates,
  renderInstructions,
} from './utils/format-list-all-templates-response';
import { getConversationTemplateService } from './utils/conversation-service-helper';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

export const registerListAllTemplates = (server: McpServer, tags: Tags[]) => {
  if (!tags.includes('all') && !tags.includes('conversation') && !tags.includes('notification')) {
    return;
  }

  server.tool(
    'list-all-templates',
    'Get a list of all templates (omni-channel or channel specific) belonging to an account',
    listAllTemplatesHandler
  );
};

export const listAllTemplatesHandler = async (): Promise<IPromptResponse> => {
  const maybeClient = getConversationTemplateService();
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
