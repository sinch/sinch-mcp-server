import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hasMatchingTag, isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getMailgunCredentials } from './utils/mailgun-service-helper';

const eventTypes = [
  'accepted', 'rejected', 'delivered', 'failed',
  'opened', 'clicked', 'unsubscribed', 'complained', 'stored'
] as const;

type EventType = (typeof eventTypes)[number];

const ListEmailEventsInput = {
  domain: z.string().optional().describe('(Optional) The Mailgun domain to fetch events for.'),
  event: z.enum(eventTypes).optional().describe('(Optional) Filter by event type (e.g., delivered, opened, failed).'),
  limit: z.number().int().min(1).max(300).optional().describe('(Optional) Number of events to return (max: 300).'),
  beginSearchPeriod: z.string().datetime().optional().describe('(Optional) The beginning of the search time range in ISO 8601 format (e.g., 2025-01-01T00:00:00Z).'),
  endSearchPeriod: z.string().datetime().optional().describe('(Optional) The end of the search time range in ISO 8601 format (e.g., 2025-01-01T00:00:00Z).'),
};

type ListEmailEventsInputSchema = z.infer<z.ZodObject<typeof ListEmailEventsInput>>;

export const registerListEmailEvents = (server: McpServer, tags: Tags[]) => {
  if (!hasMatchingTag(['all', 'email'], tags)) {
    return;
  }

  server.tool(
    'list-email-events',
    'Get a list of email events from Mailgun for a specific domain. You can filter by event type and limit the number of results.',
    ListEmailEventsInput,
    listEmailEventsHandler
  );
};

export const listEmailEventsHandler = async ({
  domain,
  event,
  limit,
  beginSearchPeriod,
  endSearchPeriod
}: ListEmailEventsInputSchema): Promise<IPromptResponse> => {
  const maybeCredentials = getMailgunCredentials(domain);
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const credentials = maybeCredentials;

  const params = new URLSearchParams();
  if (event) params.append('event', event);
  if (limit) params.append('limit', limit.toString());
  if (beginSearchPeriod) params.append('begin', (new Date(beginSearchPeriod).getTime() / 1000).toString());
  if (endSearchPeriod) params.append('end', (new Date(endSearchPeriod).getTime() / 1000).toString());
  if (beginSearchPeriod && !endSearchPeriod) {
    params.append('end', (new Date().getTime() / 1000).toString()); // Default to now if no end is provided
  }

  const url = `https://api.mailgun.net/v3/${credentials.domain}/events?${params.toString()}`;

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
    responseData = await response.json() as MailgunEventsResponse;
  } catch (error) {
    return new PromptResponse(`Failed to parse JSON response: ${error}`).promptResponse;
  }

  const grouped: Map<string, { recipient?: string; subject?: string; from?: string; events: { event: string; timestamp: string }[] }> = new Map();

  const events = responseData.items || [];
  for (const e of events) {
    const messageId = e.message?.headers['message-id'] || '(no message-id)';
    const isAccepted = e.event === 'accepted';
    const subject = isAccepted && e.message?.headers.subject ? e.message.headers.subject : undefined;
    const from = isAccepted && e.message?.headers.from ? e.message.headers.from : undefined;
    const recipient = isAccepted && e.recipient ? e.recipient : undefined;

    if (!grouped.has(messageId)) {
      grouped.set(messageId, {
        recipient,
        subject,
        from,
        events: []
      });
    }
    const group = grouped.get(messageId)!;
    if (subject && !group.subject) group.subject = subject;
    if (from && !group.from) group.from = from;
    if (recipient && !group.recipient) group.recipient = recipient;

    group.events.push({
      event: e.event || '',
      timestamp: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : ''
    });
  }

  let reply = `The following events must be presented with ALL their data, even if the ID is long, it MUST be displayed as this information can be used to get subsequent information on other API endpoints.`;
  reply += `\nFound ${events.length} email events for domain "${credentials.domain}"`
  if (event) reply += ` (filtered by event: ${event})`;
  reply += ':';

  for (const [messageId, { recipient, subject, from, events }] of grouped.entries()) {
    reply += `\n**Message ID:** ${messageId}\n`;
    if (from) reply += `From: ${from}\n`;
    if (recipient) reply += `To: ${recipient}\n`;
    if (subject) reply += `Subject: ${subject}\n`;
    reply += '| Event | Timestamp (UTC) |\n|-------|-----------------|\n';
    for (const ev of events) {
      reply += `| ${ev.event} | ${ev.timestamp} |\n`;
    }
  }

  return new PromptResponse(reply).promptResponse;
};

interface MailgunEventsResponse {
  items: MailgunEvent[];
}

interface MailgunEvent {
  timestamp?: number;
  event?: EventType;
  recipient?: string;
  message?: {
    headers: {
      'message-id': string;
      from?: string;
      subject?: string;
    };
  };
}
