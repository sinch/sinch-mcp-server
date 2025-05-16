import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetch, FormData } from 'undici';
import { z } from 'zod';
import { getMailgunCredentials } from './credentials.js';

export const registerSendEmail = (server: McpServer) => {
  server.tool(
    'send-email',
    'Send an email to a recipient with a subject and body.',
    {
      recipient: z.string().describe('The recipient of the email.'),
      subject: z.string().describe('The subject of the email.'),
      sender: z.string().optional().describe('The sender of the email.'),
      body: z.string().optional().describe('The body of the email. Can be text or HTML'),
      domain: z.string().optional().describe('The domain to use for sending the email. It would override the domain provided in the environment variables.')
    },
    async({ sender, recipient, subject, body, domain }) => {

      // Send text message
      console.error(`Sending email to ${recipient}`);

      const credentials = await getMailgunCredentials(domain);
      if ('promptResponse' in credentials) {
        console.error('No domain provided.');
        return credentials.promptResponse;
      }

      if (!sender) {
        sender = process.env.MAILGUN_SENDER_ADDRESS;
        if (!sender) {
          return {
            content: [
              {
                type: 'text',
                text: 'The "sender" is not provided and MAILGUN_SENDER_ADDRESS is no set in the environment variables.'
              }
            ]
          };
        }
      }

      const form = new FormData();
      form.set('from', sender);
      form.set('to',recipient);
      form.set('subject',subject);
      form.set('html',body);

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
        return {
          content: [
            {
              type: 'text',
              text: `An error occurred when trying to send the email: ${JSON.stringify(resp)} The status code is ${resp.status}.`
            }
          ]
        };
      }

      const data = await resp.json() as { id: string };

      return {
        content: [
          {
            type: 'text',
            text: `Email sent to ${recipient} with subject "${subject}"! The message ID is ${data.id}`
          }
        ]
      };
    }
  );
};
