import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetch, FormData } from 'undici';
import { z } from 'zod';
import { formatUserAgent, isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getMailgunCredentials } from './utils/mailgun-service-helper';
import { env } from '../../env';
import { EmailToolKey, getToolName, sha256, toolsConfig } from './utils/mailgun-tools-helper';

const SendEmailSchema = {
  recipient: z.string().describe('The recipient of the email.'),
  subject: z.string().describe('The subject of the email.'),
  sender: z.string().optional().describe('The sender of the email.'),
  body: z.string().optional().describe('The body of the email. Can be text or HTML'),
  template: z.string().optional().describe('The name of a template to use to render the email body. If provided, the body will be ignored.'),
  templateVariables: z.record(z.string()).optional().describe('Variables to use in the template.'),
  domain: z.string().optional().describe('The domain to use for sending the email. It would override the domain provided in the environment variables.'),
};

type SendEmail = z.infer<z.ZodObject<typeof SendEmailSchema>>;

const TOOL_KEY: EmailToolKey = 'sendEmail';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendEmail = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.registerTool(
    TOOL_NAME,
    {
      description: 'Send an email to a recipient with a subject and body.',
      inputSchema: SendEmailSchema,
    },
    sendEmailHandler
  );
};

export const sendEmailHandler = async ({
  recipient,
  subject,
  sender,
  body,
  template,
  templateVariables,
  domain
}: SendEmail): Promise<IPromptResponse> => {
  const maybeCredentials = getMailgunCredentials(domain);
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const credentials = maybeCredentials;

  if (!sender) {
    sender = env.MAILGUN_SENDER_ADDRESS;
    if (!sender) {
      return new PromptResponse(JSON.stringify({
        success: false,
        error: 'The "sender" is not provided and MAILGUN_SENDER_ADDRESS is no set in the environment variables.'
      })).promptResponse;
    }
  }

  const form = new FormData();
  form.set('from', sender);
  form.set('to', recipient);
  form.set('subject', subject);
  if (template) {
    form.set('template', template);
    if (templateVariables) {
      form.set('t:variables', JSON.stringify(templateVariables));
    }
  } else if (body) {
    form.set('html', body);
  } else {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: 'The "body" is not provided and no template name is specified.'
    })).promptResponse;
  }

  const resp = await fetch(
    `https://api.mailgun.net/v3/${credentials.domain}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64'),
        'User-Agent': formatUserAgent(TOOL_NAME, sha256(credentials.apiKey)),
      },
      body: form
    }
  );

  if (resp.status !== 200) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: `(${resp.status} - ${resp.statusText}) An error occurred when sending an email to ${recipient}: ${await resp.text()}`
    })).promptResponse;
  }

  const data = await resp.json() as { id: string };

  return new PromptResponse(JSON.stringify({
    success: true,
    message_id: data.id,
    recipient: recipient,
    subject: subject
  })).promptResponse;
};
