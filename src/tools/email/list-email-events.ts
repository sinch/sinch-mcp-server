import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import { formatUserAgent, isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getMailgunCredentials } from './utils/mailgun-service-helper';
import { EmailToolKey, getToolName, sha256, toolsConfig } from './utils/mailgun-tools-helper';

const eventTypes = [
  'accepted',
  'rejected',
  'delivered',
  'failed',
  'opened',
  'clicked',
  'unsubscribed',
  'complained',
  'stored',
] as const;

type EventType = (typeof eventTypes)[number];
type MailgunEventFields = { recipient?: string; subject?: string; from?: string };
type EmailEventGroup = MailgunEventFields & { events: { event: string; timestamp: string }[] };
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

const ListEmailEventsSchema = {
  domain: z.string().optional().describe('(Optional) The Mailgun domain to fetch events for.'),
  event: z.enum(eventTypes).optional().describe('(Optional) Filter by event type (e.g., delivered, opened, failed).'),
  limit: z.number().int().min(1).max(300).optional().describe('(Optional) Number of events to return (max: 300).'),
  beginSearchPeriod: z
    .string()
    .datetime()
    .optional()
    .describe('(Optional) The beginning of the search time range in ISO 8601 format (e.g., 2025-01-01T00:00:00Z).'),
  endSearchPeriod: z
    .string()
    .datetime()
    .optional()
    .describe('(Optional) The end of the search time range in ISO 8601 format (e.g., 2025-01-01T00:00:00Z).'),
};

type ListEmailEvents = z.infer<z.ZodObject<typeof ListEmailEventsSchema>>;

const TOOL_KEY: EmailToolKey = 'listEmailEvents';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerListEmailEvents = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Get a raw log of individual email events from Mailgun for a specific domain, not aggregated rates or totals — for those, use analytics-metrics instead. You can filter by event type and limit the number of results.',
      inputSchema: ListEmailEventsSchema,
    },
    listEmailEventsHandler,
  );
};

export const listEmailEventsHandler = async ({
  domain,
  event,
  limit,
  beginSearchPeriod,
  endSearchPeriod,
}: ListEmailEvents): Promise<IPromptResponse> => {
  const maybeCredentials = getMailgunCredentials(domain);
  if (isPromptResponse(maybeCredentials)) {
    return maybeCredentials.promptResponse;
  }
  const credentials = maybeCredentials;

  const params = getUrlSearchParams({ event, limit, beginSearchPeriod, endSearchPeriod });
  const url = `https://api.mailgun.net/v3/${credentials.domain}/events?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${credentials.apiKey}`).toString('base64'),
      'User-Agent': formatUserAgent(TOOL_NAME, sha256(credentials.apiKey)),
    },
  });

  if (!response.ok) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: `Mailgun API error: ${response.status} ${response.statusText}`,
      }),
    ).promptResponse;
  }

  let responseData;
  try {
    responseData = (await response.json()) as MailgunEventsResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    ).promptResponse;
  }

  const events = responseData.items || [];
  const grouped = groupEventsByMessageId(events);

  const groupedArray = Array.from(grouped.entries()).map(([messageId, data]) => ({
    message_id: messageId,
    from: data.from,
    to: data.recipient,
    subject: data.subject,
    events: data.events,
  }));

  return new PromptResponse(
    JSON.stringify({
      events: groupedArray,
      total_count: events.length,
    }),
  ).promptResponse;
};

const getUrlSearchParams = ({ event, limit, beginSearchPeriod, endSearchPeriod }: ListEmailEvents): URLSearchParams => {
  const searchParams = new URLSearchParams();
  if (event) {
    searchParams.append('event', event);
  }
  if (limit) {
    searchParams.append('limit', limit.toString());
  }
  if (beginSearchPeriod) {
    searchParams.append('begin', (new Date(beginSearchPeriod).getTime() / 1000).toString());
  }
  if (endSearchPeriod) {
    searchParams.append('end', (new Date(endSearchPeriod).getTime() / 1000).toString());
  }
  if (beginSearchPeriod && !endSearchPeriod) {
    searchParams.append('end', (Date.now() / 1000).toString()); // Default to now if no end is provided
  }
  return searchParams;
};

// Only the "accepted" event carries the recipient/subject/from headers; later events
// for the same message-id (delivered, opened, ...) only add to the events timeline.
const acceptedFieldsOf = (e: MailgunEvent): MailgunEventFields =>
  e.event === 'accepted'
    ? { recipient: e.recipient, subject: e.message?.headers.subject, from: e.message?.headers.from }
    : {};

const groupEventsByMessageId = (events: MailgunEvent[]): Map<string, EmailEventGroup> => {
  const grouped = new Map<string, EmailEventGroup>();

  for (const e of events) {
    const messageId = e.message?.headers['message-id'] || '(no message-id)';
    const group = grouped.get(messageId) ?? { events: [] };
    grouped.set(messageId, group);

    const accepted = acceptedFieldsOf(e);
    group.subject ??= accepted.subject;
    group.from ??= accepted.from;
    group.recipient ??= accepted.recipient;

    group.events.push({
      event: e.event || '',
      timestamp: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : '',
    });
  }

  return grouped;
};
