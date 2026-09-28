import { context, trace } from '@opentelemetry/api';
import pino from 'pino';

const LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

let baseLogger: pino.Logger | undefined;

const getBaseLogger = (): pino.Logger => {
  if (!baseLogger) {
    const configuredLevel = process.env.LOG_LEVEL;
    const level = configuredLevel && LOG_LEVELS.has(configuredLevel) ? configuredLevel : 'info';
    baseLogger = pino({ level }, pino.destination(2));
  }
  return baseLogger;
};

const traceFields = (): Record<string, string> => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }
  const { traceId, spanId } = span.spanContext();
  return { trace_id: traceId, span_id: spanId };
};

const log = (level: 'info' | 'warn' | 'error' | 'debug') => (obj: object | string, msg?: string) => {
  const baseLogger = getBaseLogger();
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
