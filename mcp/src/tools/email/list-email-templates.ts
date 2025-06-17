import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { z } from 'zod';
import { getMailgunCredentials } from './utils/mailgun-service-helper';
import { EmailToolKey, getToolName, shouldRegisterTool } from './utils/mailgun-tools-helper';
import { isPromptResponse } from '../../utils';

const TOOL_KEY: EmailToolKey = 'listEmailTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListEmailTemplates = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Get a list of Email templates from Mailgun for a specific domain. Note that the Messaging templates (omni-channel or channel-specific such as WhatsApp) are NOT included in this list - they can be found with another tool: list-messaging-templates. Do not try to use this tool to list Messaging templates, it will not work.',
    {
      domain: z.string().optional().describe('The domain to use for sending the email. It would override the domain provided in the environment variables.')
    },
    listEmailTemplatesHandler
  );
};

export const listEmailTemplatesHandler = async ({
  domain
}: {
  domain?: string;
}): Promise<IPromptResponse> => {
  const maybeCredentials = await getMailgunCredentials(domain);
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const credentials = maybeCredentials;

  const url = `https://api.mailgun.net/v3/${credentials.domain}/templates`;

  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64')
    }
  });

  if (!response.ok) {
    return new PromptResponse(`Mailgun API error: ${response.status} ${response.statusText}`).promptResponse;
  }

  let responseData;
  try {
    responseData = await response.json() as MailgunTemplatesResponse;
  } catch (error) {
    return new PromptResponse(`Failed to parse JSON response: ${error}`).promptResponse;
  }

  let reply = `The following templates must be presented as an array ALL their data in 3 columns: Name, Description and Creation Date. Do not omit anything.\n\n`;
  reply += `Found ${responseData.items.length} Email templates for domain "${credentials.domain}":\n\n`;
  reply += '| Name | Description | Creation Date |\n'
  reply += '|------|-------------|---------------|\n';
  for (const template of responseData.items) {
    reply += `| ${template.name} | ${template.description || '(No description)'} | ${template.createdAt ? new Date(template.createdAt).toISOString() : ''} |\n`;
  }

  return new PromptResponse(reply).promptResponse;
}

interface MailgunTemplatesResponse {
  items: MailgunTemplate[];
}

interface MailgunTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}
