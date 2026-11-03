import { context, trace } from '@opentelemetry/api';
import { isAxiosError } from 'axios';
import pino from 'pino';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_LEVEL_SET: ReadonlySet<string> = new Set(LOG_LEVELS);

export const normalizeLogLevel = (value: string | undefined): LogLevel => {
  const normalizedValue = value?.toLowerCase();
  return normalizedValue && LOG_LEVEL_SET.has(normalizedValue) ? (normalizedValue as LogLevel) : 'info';
};

export const REDACT_PATHS = [
  'authorization',
  '*.authorization',
  '*.Authorization',
  '*.headers.authorization',
  '*.headers.Authorization',
  'password',
  '*.password',
  'keySecret',
  '*.keySecret',
  'key_secret',
  '*.key_secret',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'secret',
  '*.secret',
  'key',
  '*.key',
  'apiKey',
  '*.apiKey',
  'api_key',
  '*.api_key',
  'clientSecret',
  '*.clientSecret',
  'client_secret',
  '*.client_secret',
  'refreshToken',
  '*.refreshToken',
  'cookie',
  '*.cookie',
  'headers["x-api-key"]',
  '*.headers["x-api-key"]',
  'err.config.headers',
  'err.config.params',
  'err.config.auth',
  'err.config.data',
  'err.request',
  'err.response.config',
];

const stripQuery = (url: string): string => {
  const index = url.search(/[?#]/);
  return index === -1 ? url : url.slice(0, index);
};

const serializeError = (error: unknown, depth: number): Record<string, unknown> => {
  if (typeof error !== 'object' || error === null) {
    return { message: String(error) };
  }
  const err = error as Error & { code?: unknown; cause?: unknown };
  const out: Record<string, unknown> = { type: err.name, message: err.message, stack: err.stack };
  if (typeof err.code === 'string' || typeof err.code === 'number') {
    out.code = err.code;
  }
  if (isAxiosError(error)) {
    if (typeof error.response?.status === 'number') {
      out.status = error.response.status;
    }
    if (typeof error.config?.method === 'string') {
      out.method = error.config.method.toUpperCase();
    }
    if (typeof error.config?.url === 'string') {
      out.url = stripQuery(error.config.url);
    }
  }
  if (err.cause !== undefined && depth < 1) {
    out.cause = serializeError(err.cause, depth + 1);
  }
  return out;
};

export const safeErrSerializer = (error: unknown): Record<string, unknown> => serializeError(error, 0);

export const buildLoggerOptions = (level: LogLevel): pino.LoggerOptions => ({
  level,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  serializers: { err: safeErrSerializer, error: safeErrSerializer },
});

let baseLogger: pino.Logger | undefined;

const getBaseLogger = (): pino.Logger => {
  if (!baseLogger) {
    const configuredLevel = process.env.LOG_LEVEL;
    const level = normalizeLogLevel(configuredLevel);
    baseLogger = pino(buildLoggerOptions(level), pino.destination(2));
    if (configuredLevel && configuredLevel.toLowerCase() !== level) {
      baseLogger.warn(
        {
          configured_log_level: configuredLevel,
          fallback_log_level: 'info',
          valid_log_levels: LOG_LEVELS,
        },
        `LOG_LEVEL="${configuredLevel}" is not a valid level; using "info". Valid: ${LOG_LEVELS.join(', ')}`,
      );
    }
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
  if (obj instanceof Error) {
    baseLogger[level]({ ...traceFields(), err: obj }, msg);
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
