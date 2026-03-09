import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { z } from 'zod';
import { getMailgunCredentials } from './utils/mailgun-service-helper';
import { EmailToolKey, getToolName, sha256, toolsConfig } from './utils/mailgun-tools-helper';
import { formatUserAgent, isPromptResponse, matchesAnyTag } from '../../utils';

const TOOL_KEY: EmailToolKey = 'listEmailTemplates';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListEmailTemplates = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

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
      'Authorization': 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64'),
      'User-Agent': formatUserAgent(TOOL_NAME, sha256(credentials.apiKey)),
    }
  });

  if (!response.ok) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: `Mailgun API error: ${response.status} ${response.statusText}`
    })).promptResponse;
  }

  let responseData;
  try {
    responseData = await response.json() as MailgunTemplatesResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })).promptResponse;
  }

  return new PromptResponse(JSON.stringify({
    templates: responseData.items.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description || null,
      createdAt: template.createdAt ? new Date(template.createdAt).toISOString() : null
    })),
    total_count: responseData.items.length
  })).promptResponse;
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
