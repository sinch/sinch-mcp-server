import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { getMailgunApiKey } from './utils/mailgun-service-helper';

const metricsTypes = [
  // Counts
  'accepted_incoming_count',
  'accepted_outgoing_count',
  'accepted_count',
  'delivered_smtp_count',
  'delivered_http_count',
  'delivered_optimized_count',
  'delivered_count',
  'stored_count',
  'processed_count',
  'sent_count',
  'opened_count',
  'clicked_count',
  'unique_opened_count',
  'unique_clicked_count',
  'unsubscribed_count',
  'complained_count',
  'failed_count',
  'temporary_failed_count',
  'permanent_failed_count',
  'temporary_failed_esp_block_count',
  'permanent_failed_esp_block_count',
  'rate_limit_count',
  'webhook_count',
  'permanent_failed_optimized_count',
  'permanent_failed_old_count',
  'bounced_count',
  'hard_bounces_count',
  'soft_bounces_count',
  'delayed_bounce_count',
  'suppressed_bounces_count',
  'suppressed_unsubscribed_count',
  'suppressed_complaints_count',
  'delivered_first_attempt_count',
  'delayed_first_attempt_count',
  'delivered_subsequent_count',
  'delivered_two_plus_attempts_count',
  // Rates
  'bounced_rate',
  'clicked_rate',
  'complained_rate',
  'delayed_rate',
  'delivered_rate',
  'fail_rate',
  'opened_rate',
  'permanent_fail_rate',
  'temporary_fail_rate',
  'unique_clicked_rate',
  'unique_opened_rate',
  'unsubscribed_rate'
] as const;

type MetricsType = typeof metricsTypes[number];

const AnalyticsMetricsInput = {
  domain: z.string().optional().describe('(Optional) The Mailgun domain to fetch metrics for.'),
  metrics: z.array(z.enum(metricsTypes)).optional().describe('(Optional) The specific metrics to receive the stats for. If not provided, all metrics will be returned.'),
  beginSearchPeriod: z.string().optional().describe('(Optional) The beginning of the search time range in RFC-2822 format (e.g., Mon, 02 Jun 2025 00:00:00 +0100).'),
  endSearchPeriod: z.string().optional().describe('(Optional) The end of the search time range in RFC-2822 format (e.g., Mon, 09 Jun 2025 00:00:00 +0100).'),
}

const AnalyticsMetricsInputSchema = z.object(AnalyticsMetricsInput);

export const registerAnalyticsMetrics = (server: McpServer, tags: Tags[]) => {
  if (!tags.includes('all') && !tags.includes('email')) {
    return;
  }

  server.tool(
    'analytics-metrics',
    'Get email analytics metrics from Mailgun for an account. All parameters are optional. You can filter by domain, metrics type and specify a time range. By default, it will return all metrics for all your domains for the last 7 days.',
    AnalyticsMetricsInput,
    analyticsMetricsHandler
  );
};

export const analyticsMetricsHandler = async ({
  domain,
  metrics,
  beginSearchPeriod,
  endSearchPeriod
}: z.infer<typeof AnalyticsMetricsInputSchema>): Promise<IPromptResponse> => {
  const maybeApiKey = getMailgunApiKey();
  if (typeof maybeApiKey !== 'string') {
    return maybeApiKey.promptResponse;
  }
  const mailgunApiKey = maybeApiKey;

  const body: Record<string, any> = {};
  if (domain) body.domain = {
    AND: [
      {
        attribute: 'domain',
        comparator: '=',
        values: [
          {
            label: domain,
            value: domain
          }
        ]
      }
    ]
  };
  if (metrics && metrics.length > 0) {
    body.metrics = metrics;
  } else {
    body.metrics = metricsTypes;
  }
  if (beginSearchPeriod) body.begin = beginSearchPeriod;
  if (endSearchPeriod) body.end = endSearchPeriod;
  body.include_aggregates = true;

  const url = `https://api.mailgun.net/v1/analytics/metrics`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api:${mailgunApiKey}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return new PromptResponse(`Mailgun API error: ${response.status} ${response.statusText}`).promptResponse;
  }

  let responseData;
  try {
    responseData = await response.json() as MailgunAnalyticsMetricsResponse;
  } catch (error) {
    return new PromptResponse(`Failed to parse JSON response: ${error}`).promptResponse;
  }

  let result = `The following data must be presented graphically. Mailgun Analytics Metrics for domain "${domain || 'all'}":\n\n`;
  result += JSON.stringify(responseData.aggregates)

  return new PromptResponse(result).promptResponse;
}

interface MailgunAnalyticsMetricsResponse {
  aggregates: {
    metrics: Record<MetricsType, number>;
  }
}
