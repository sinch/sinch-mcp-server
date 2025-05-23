import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { SinchConversationCredentials } from '../../db-utils';
import { buildSinchClientForTemplates, getConversationCredentials } from './credentials.js';

export const registerListAllTemplates = (server: McpServer) => {
  server.tool(
    'list-all-templates',
    'Get a list of all templates (omni-channel or channel specific) belonging to an account',
    {
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async({ sessionId }) => {
      console.error('Listing all templates');

      const credentials = await getConversationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No token found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      const sinchClient = buildSinchClientForTemplates(credentials);
      const responseUS = await sinchClient.conversation.templatesV2.list({});

      sinchClient.conversation.setRegion('eu');
      const responseEU = await sinchClient.conversation.templatesV2.list({});

      sinchClient.conversation.setRegion('br');
      const responseBR = await sinchClient.conversation.templatesV2.list({});

      let reply = `List of omni-channels templates in the US region: ${JSON.stringify(stripTemplateData(responseUS))}`;
      reply += `\nList of omni-channels templates in the EU region: ${JSON.stringify(stripTemplateData(responseEU))}`;
      reply += `\nList of omni-channels templates in the BR region: ${JSON.stringify(stripTemplateData(responseBR))}`;

      const whatsAppTemplates = await fetchWhatsAppSpecificTemplates(credentials);

      reply += `\nList of WhatsApp templates: ${JSON.stringify(whatsAppTemplates)}`;

      return {
        content: [
          {
            type: 'text',
            text: `${reply}.\nPlease return the data in a structured array format with each item on a separate line. One array for omni-channel templates and and another for channel specific templates.
            For the omni-channel templates, just display the Id, description, version, default translation and the list of translations as bullet list (indicating the pair language_code and version) columns. Example:
| ID   | Description       | Version | Default translation | Translations                      |
| 0123 | My template desc  | 1       | en-US               | pairs of language_code and version as an internal array |
Example of internal array for the pairs of language_code and version
| en-US | 1 |
| en-US | latest |
            For the channel specific templates, just display the channel, the name, the language, the category and the state columns. Example:
| Channel  | Name         | Language | Category  | State    |
| WhatsApp | wa_template  | en-US    | Marketing | Approved |`
          }
        ]
      };
    }
  );
};

const fetchWhatsAppSpecificTemplates = async (credentials: SinchConversationCredentials) => {
  const resp = await fetch(
    `https://provisioning.api.sinch.com/v1/projects/${credentials.projectId}/whatsapp/templates`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${process.env.CONVERSATION_KEY_ID}:${process.env.CONVERSATION_KEY_SECRET}`).toString('base64')
      }
    }
  );

  console.error(resp.status);

  const data = await resp.json();

  const templatesList = [];
  for (const template of data.templates) {
    templatesList.push({
      channel: 'WhatsApp',
      name: template.name,
      language: template.language,
      category: template.category,
      state: template.state
    });
  }
  return templatesList;
};

const stripTemplateData = (data: Conversation.V2ListTemplatesResponse) => {
  if (!data.templates) return [];

  const templatesList = [];
  for (const template of data.templates) {
    const translations = template.translations?.map((translation) => {
      return `${translation.language_code} (version "${translation.version}")`;
    });
    templatesList.push({
      id: template.id,
      description: template.description,
      version: template.version,
      defaultTranslation: template.default_translation,
      translations: translations
    });
  }

  return templatesList;
};
