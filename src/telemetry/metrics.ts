import { metrics, type Counter, type Histogram } from '@opentelemetry/api';
import {
  METRIC_SESSION_STORE_DEGRADED_TOTAL,
  METRIC_SINCH_API_DURATION_MS,
  METRIC_TOOL_CALLS_TOTAL,
  METRIC_TOOL_DURATION_MS,
  METRIC_TOOL_ERRORS_TOTAL,
  METER_NAME,
  DURATION_BUCKETS_MS,
} from './constants';

export interface ToolMetrics {
  toolCallsTotal: Counter;
  toolErrorsTotal: Counter;
  toolDurationMs: Histogram;
  sinchApiDurationMs: Histogram;
}

export interface SessionStoreMetrics {
  degradedTotal: Counter;
}

let toolMetrics: ToolMetrics | undefined;
let sessionStoreMetrics: SessionStoreMetrics | undefined;

export const resetToolMetricsForTests = (): void => {
  toolMetrics = undefined;
};

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
        advice: { explicitBucketBoundaries: DURATION_BUCKETS_MS },
      }),
      sinchApiDurationMs: meter.createHistogram(METRIC_SINCH_API_DURATION_MS, {
        description: 'Sinch API call duration in milliseconds',
        unit: 'ms',
        advice: { explicitBucketBoundaries: DURATION_BUCKETS_MS },
      }),
    };
  }
  return toolMetrics;
};

export const getSessionStoreMetrics = (): SessionStoreMetrics => {
  if (!sessionStoreMetrics) {
    const meter = metrics.getMeter(METER_NAME);
    sessionStoreMetrics = {
      degradedTotal: meter.createCounter(METRIC_SESSION_STORE_DEGRADED_TOTAL, {
        description: 'Total number of requests handled in degraded mode because the session store was unavailable',
      }),
    };
  }
  return sessionStoreMetrics;
};

/** Exposed for unit tests. */
export const resetSessionStoreMetricsForTests = (): void => {
  sessionStoreMetrics = undefined;
};
