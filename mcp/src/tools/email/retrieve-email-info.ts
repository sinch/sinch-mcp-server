import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse } from '../../types';
import { getMailgunCredentials } from './utils/mailgun-service-helper';

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

export const registerRetrieveEmailInfo = (server: McpServer) => {
  server.tool(
    'retrieve-email-info',
    'Retrieve the content of an email and the events that happened thanks to its ID',
    {
      emailId: z.string().describe('The email ID.'),
      domain: z.string().optional().describe('The domain to use for retrieving the email. If defined, it will override the domain provided in the environment variable "MAILGUN_DOMAIN".')
    },
    retrieveEmailInfoHandler
  );
};

export const retrieveEmailInfoHandler = async({
  emailId,
  domain
}: {
  emailId: string;
  domain?: string;
}): Promise<IPromptResponse> => {
  const maybeCredentials = await getMailgunCredentials(domain);
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const credentials = maybeCredentials;

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
    return new PromptResponse(`An error occurred when trying to retrieve the events related to the email ID ${emailId}. The status code is ${resp.status}.`).promptResponse;
  }

  const data = await resp.json() as EventList;
  let storageUrl;
  const eventSummary = [];
  for (const event of data.items) {
    const eventType = event.event;
    if (eventType === 'accepted') {
      storageUrl = event.storage.url;
    }
    eventSummary.push(`Event: ${eventType}, Timestamp: ${new Date(event.timestamp * 1000).toISOString()}`);
  }

  let result = `Summary of events to be presented into an table in chronological order: ${eventSummary}.`

  const storedEmail = await fetch(
    storageUrl!,
    {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64')
      }
    }
  );

  if (resp.status !== 200) {
    // Don't fail the tool if the email content cannot be retrieved, just inform the user
    result += `\nBut an error occurred when trying to retrieve the events related to the email ID ${emailId}. The status code is ${resp.status}.`;
  } else {
    const storedEmailData = await storedEmail.json() as { 'body-html': string };
    result += `\nEmail content: ${storedEmailData['body-html']}.`;
  }

  return new PromptResponse(result).promptResponse;
}
