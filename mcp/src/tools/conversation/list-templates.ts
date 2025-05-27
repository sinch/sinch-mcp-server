import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isPromptResponse } from '../../utils';
import process from 'process';
import { formatListAllTemplatesResponse } from './utils/format-list-all-templates-response';
import { getConversationTemplateService } from './utils/conversation-service-helper';

export const registerListAllTemplates = (server: McpServer) => {
  server.tool(
    'list-all-templates',
    'Get a list of all templates (omni-channel or channel specific) belonging to an account',
    {},
    async({}) => {
      console.error('Listing all templates');

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

      let reply = `List of omni-channels templates in the US region: ${JSON.stringify(formatListAllTemplatesResponse(responseUS))}`;
      reply += `\nList of omni-channels templates in the EU region: ${JSON.stringify(formatListAllTemplatesResponse(responseEU))}`;
      reply += `\nList of omni-channels templates in the BR region: ${JSON.stringify(formatListAllTemplatesResponse(responseBR))}`;

      const whatsAppTemplates = await fetchWhatsAppSpecificTemplates();

      reply += `\nList of WhatsApp templates: ${JSON.stringify(whatsAppTemplates)}`;

      return {
        content: [
          {
            type: 'text',
            text: `${reply}.\nPlease return the data in a structured array format with each item on a separate line. One array for omni-channel templates and and another for channel specific templates.
            For the omni-channel templates, just display the Id, description, version, default translation and the list of translations as as pairs of language_code / version) columns. Example:
| ID   | Description       | Version | Default translation | Translations            |
| 0123 | My template desc  | 1       | en-US               | en-US(latest), en-US(1) |
            For the WhatsApp templates (called channel specific), just display the channel, the name, the language, the category and the state columns. Example:
| Channel  | Name         | Language | Category  | State    |
| WhatsApp | wa_template  | en-US    | Marketing | Approved |`
          }
        ]
      };
    }
  );
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
