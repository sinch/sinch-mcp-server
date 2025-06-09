import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetch, FormData } from 'undici';
import { z } from 'zod';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getMailgunCredentials } from './utils/mailgun-service-helper';

export const registerSendEmail = (server: McpServer, tags: Tags[]) => {
  if (!tags.includes('all') && !tags.includes('email') && !tags.includes('notification')) {
    return;
  }

  server.tool(
    'send-email',
    'Send an email to a recipient with a subject and body.',
    {
      recipient: z.string().describe('The recipient of the email.'),
      subject: z.string().describe('The subject of the email.'),
      sender: z.string().optional().describe('The sender of the email.'),
      body: z.string().optional().describe('The body of the email. Can be text or HTML'),
      template: z.string().optional().describe('The name of a template to use to render the email body. If provided, the body will be ignored.'),
      templateVariables: z.record(z.string()).optional().describe('Variables to use in the template.'),
      domain: z.string().optional().describe('The domain to use for sending the email. It would override the domain provided in the environment variables.')
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
}: {
  recipient: string;
  subject: string;
  sender?: string;
  body?: string;
  template?: string;
  templateVariables?: Record<string, string>;
  domain?: string;
}): Promise<IPromptResponse> => {
  const maybeCredentials = getMailgunCredentials(domain);
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const credentials = maybeCredentials;

  if (!sender) {
    sender = process.env.MAILGUN_SENDER_ADDRESS;
    if (!sender) {
      return new PromptResponse('The "sender" is not provided and MAILGUN_SENDER_ADDRESS is no set in the environment variables.').promptResponse;
    }
  }

  const form = new FormData();
  form.set('from', sender);
  form.set('to',recipient);
  form.set('subject',subject);
  if (template) {
    form.set('template', template);
    if (templateVariables) {
      form.set('t:variables', JSON.stringify(templateVariables));
    }
  } else if (body) {
    form.set('html', body);
  } else {
    return new PromptResponse('The "body" is not provided and no template name is specified.').promptResponse;
  }

  const resp = await fetch(
    `https://api.mailgun.net/v3/${credentials.domain}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64')
      },
      body: form
    }
  );

  if (resp.status !== 200) {
    return new PromptResponse(`An error occurred when trying to send the email: ${JSON.stringify(resp)} The status code is ${resp.status}: ${resp.statusText}.`).promptResponse;
  }

  const data = await resp.json() as { id: string };

  return new PromptResponse(`Email sent to ${recipient} with subject "${subject}"! The message ID is ${data.id}`).promptResponse;
};
