import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getMailgunCredentials } from './credentials.js';

interface EventList {
  items: Event[];
}

interface Event {
  event?: string;
  timestamp: number;
  storage: {
    key: string;
    url: string;
  };
}

export const registerRetrieveEmailContent = (server: McpServer) => {
  server.tool(
    'retrieve-email-info',
    'Retrieve the content of an email and the events that happened thanks to its ID',
    {
      emailId: z.string().describe('The email ID.'),
      domain: z.string().optional().describe('The domain to use for retrieving the email. It would override the domain provided in the environment variables.')
    },
    async({ emailId, domain }) => {

      // Send text message
      console.error(`Retrieving email '${emailId}'`);

      const credentials = await getMailgunCredentials(domain);
      if ('promptResponse' in credentials) {
        console.error('No domain provided.');
        return credentials.promptResponse;
      }

      const resp = await fetch(
        `https://api.mailgun.net/v3/${credentials.domain}/events?message-id=${emailId}`,
        {
          method: 'GET',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64')
          }
        }
      );

      if (resp.status !== 200) {
        return {
          content: [
            {
              type: 'text',
              text: `An error occurred when trying to retrieve the events related to the email ID ${emailId}. The status code is ${resp.status}.`
            }
          ]
        };
      }

      const data: EventList = await resp.json();
      let storageUrl;
      const eventSummary = [];
      for (const event of data.items) {
        const eventType = event.event;
        if (eventType === 'accepted') {
          storageUrl = event.storage.url;
        }
        eventSummary.push(`Event: ${eventType}, Timestamp: ${new Date(event.timestamp * 1000).toISOString()}`);
      }

      const storedEmail = await fetch(
        storageUrl!,
        {
          method: 'GET',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64')
          }
        }
      );

      const storedEmailData: { 'body-html': string } = await storedEmail.json();

      return {
        content: [
          {
            type: 'text',
            text: `Summary of events to be presented into an table in chronological order: ${eventSummary}. Email content: ${storedEmailData['body-html']}`
          }
        ]
      };

    }
  );
};
