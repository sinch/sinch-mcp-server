import { context, trace } from '@opentelemetry/api';
import pino from 'pino';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_LEVEL_SET: ReadonlySet<string> = new Set(LOG_LEVELS);

let baseLogger: pino.Logger | undefined;

const getBaseLogger = (): pino.Logger => {
  if (!baseLogger) {
    const configuredLevel = process.env.LOG_LEVEL;
    // This must tolerate invalid raw input so env.ts can log its validation failure.
    const level = configuredLevel && LOG_LEVEL_SET.has(configuredLevel) ? configuredLevel : 'info';
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

type LoggerMethodLevel = Exclude<LogLevel, 'silent'>;

const log = (level: LoggerMethodLevel) => (obj: object | string, msg?: string) => {
  const baseLogger = getBaseLogger();
  if (typeof obj === 'string') {
    baseLogger[level]({ ...traceFields() }, obj);
    return;
  }
  baseLogger[level]({ ...traceFields(), ...obj }, msg);
};

export const logger = {
  fatal: log('fatal'),
  info: log('info'),
  warn: log('warn'),
  error: log('error'),
  debug: log('debug'),
  trace: log('trace'),
};
