import { metrics, type Counter, type Histogram, type UpDownCounter } from '@opentelemetry/api';
import {
  METRIC_HTTP_ACTIVE_CONNECTIONS,
  METRIC_HTTP_ACTIVE_REQUESTS,
  METRIC_HTTP_DURATION_MS,
  METRIC_HTTP_ERRORS_TOTAL,
  METRIC_HTTP_REQUESTS_TOTAL,
  METRIC_REDIS_AVAILABLE,
  METRIC_REDIS_COMMAND_DURATION_MS,
  METRIC_REDIS_DURATION_MS,
  METRIC_REDIS_FAILURES_TOTAL,
  METRIC_REDIS_OPERATIONS_TOTAL,
  METRIC_SESSIONS_CREATED_TOTAL,
  METRIC_SESSIONS_DELETED_TOTAL,
  METRIC_SINCH_API_DURATION_MS,
  METRIC_TOOL_CALLS_TOTAL,
  METRIC_TOOL_DURATION_MS,
  METRIC_TOOL_ERRORS_TOTAL,
  METER_NAME,
} from './constants';

export interface ToolMetrics {
  toolCallsTotal: Counter;
  toolErrorsTotal: Counter;
  toolDurationMs: Histogram;
  sinchApiDurationMs: Histogram;
}

export interface ServiceMetrics {
  httpRequestsTotal: Counter;
  httpErrorsTotal: Counter;
  httpDurationMs: Histogram;
  httpActiveRequests: UpDownCounter;
  httpActiveConnections: UpDownCounter;
  sessionsCreatedTotal: Counter;
  sessionsDeletedTotal: Counter;
  redisOperationsTotal: Counter;
  redisFailuresTotal: Counter;
  redisDurationMs: Histogram;
  redisCommandDurationMs: Histogram;
}

let toolMetrics: ToolMetrics | undefined;
let serviceMetrics: ServiceMetrics | undefined;
let redisAvailable: number | undefined;

export const getToolMetrics = (): ToolMetrics => {
  if (!toolMetrics) {
    const meter = metrics.getMeter(METER_NAME);
    toolMetrics = {
      toolCallsTotal: meter.createCounter(METRIC_TOOL_CALLS_TOTAL, {
        description: 'Total number of MCP tool invocations',
      }),
      toolErrorsTotal: meter.createCounter(METRIC_TOOL_ERRORS_TOTAL, {
        description: 'Total number of MCP tool invocation errors',
      }),
      toolDurationMs: meter.createHistogram(METRIC_TOOL_DURATION_MS, {
        description: 'MCP tool invocation duration in milliseconds',
        unit: 'ms',
      }),
      sinchApiDurationMs: meter.createHistogram(METRIC_SINCH_API_DURATION_MS, {
        description: 'Sinch API call duration in milliseconds',
        unit: 'ms',
      }),
    };
  }
  return toolMetrics;
};

export const getServiceMetrics = (): ServiceMetrics => {
  if (!serviceMetrics) {
    const meter = metrics.getMeter(METER_NAME);
    const availability = meter.createObservableGauge(METRIC_REDIS_AVAILABLE, {
      description: 'Whether the most recent Redis operation succeeded (1) or failed (0)',
    });
    availability.addCallback((result) => {
      if (redisAvailable !== undefined) {
        result.observe(redisAvailable);
      }
    });
    serviceMetrics = {
      httpRequestsTotal: meter.createCounter(METRIC_HTTP_REQUESTS_TOTAL),
      httpErrorsTotal: meter.createCounter(METRIC_HTTP_ERRORS_TOTAL),
      httpDurationMs: meter.createHistogram(METRIC_HTTP_DURATION_MS, { unit: 'ms' }),
      httpActiveRequests: meter.createUpDownCounter(METRIC_HTTP_ACTIVE_REQUESTS),
      httpActiveConnections: meter.createUpDownCounter(METRIC_HTTP_ACTIVE_CONNECTIONS),
      sessionsCreatedTotal: meter.createCounter(METRIC_SESSIONS_CREATED_TOTAL),
      sessionsDeletedTotal: meter.createCounter(METRIC_SESSIONS_DELETED_TOTAL),
      redisOperationsTotal: meter.createCounter(METRIC_REDIS_OPERATIONS_TOTAL),
      redisFailuresTotal: meter.createCounter(METRIC_REDIS_FAILURES_TOTAL),
      redisDurationMs: meter.createHistogram(METRIC_REDIS_DURATION_MS, {
        description: 'End-to-end logical Redis operation duration, including retries and backoff',
        unit: 'ms',
      }),
      redisCommandDurationMs: meter.createHistogram(METRIC_REDIS_COMMAND_DURATION_MS, {
        description: 'Duration of one Redis command attempt, excluding retry backoff',
        unit: 'ms',
      }),
    };
  }
  return serviceMetrics;
};

export const setRedisAvailable = (available: boolean): void => {
  redisAvailable = available ? 1 : 0;
};
