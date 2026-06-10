import { context, trace } from '@opentelemetry/api';
import pino from 'pino';
import { isTelemetryEnabled } from './config';

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isTelemetryEnabled()
    ? {}
    : {
        transport: undefined,
      }),
});

const traceFields = (): Record<string, string> => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }
  const { traceId, spanId } = span.spanContext();
  return { trace_id: traceId, span_id: spanId };
};

const log =
  (level: 'info' | 'warn' | 'error' | 'debug') =>
  (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      baseLogger[level]({ ...traceFields() }, obj);
      return;
    }
    baseLogger[level]({ ...traceFields(), ...obj }, msg);
  };

export const logger = {
  info: log('info'),
  warn: log('warn'),
  error: log('error'),
  debug: log('debug'),
};
