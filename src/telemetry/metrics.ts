import { metrics, type Counter, type Histogram } from '@opentelemetry/api';
import {
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

let toolMetrics: ToolMetrics | undefined;

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
