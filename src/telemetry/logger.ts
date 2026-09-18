import { context, trace } from '@opentelemetry/api';
import pino from 'pino';
import { env } from '../env';

const REDACTED_FIELDS = [
  'authorization',
  'Authorization',
  'headers.authorization',
  'headers.Authorization',
  'req.headers.authorization',
  'request.headers.authorization',
  'password',
  'keySecret',
  'key_secret',
  'apiKey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
];

const errorType = (error: unknown): string => (error instanceof Error ? error.name : 'UnknownError');

const baseLogger = pino(
  {
    level: env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACTED_FIELDS, remove: true },
    // Error messages from HTTP clients can contain response bodies, URLs, or headers.
    // Emit only the type at normal log levels; detailed failures belong in protected traces.
    serializers: {
      err: (error: unknown) => ({ type: errorType(error) }),
    },
  },
  pino.destination(2),
);

const traceFields = (): Record<string, string> => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }
  const { traceId, spanId } = span.spanContext();
  return { trace_id: traceId, span_id: spanId };
};

const log = (level: 'info' | 'warn' | 'error' | 'debug') => (obj: object | string, msg?: string) => {
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

export const safeErrorFields = (error: unknown): { error_type: string } => ({
  error_type: errorType(error),
});
