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

const redactSensitiveText = (message: string): string => {
  let sanitized = message
    .replace(
      /(authorization\s*[:=]\s*)(?:(Bearer|Basic)\s+)?[^,\s}"']+/gi,
      (_match, prefix: string, scheme: string | undefined) => `${prefix}${scheme ? `${scheme} ` : ''}[Redacted]`,
    )
    .replace(/\b(Bearer|Basic)\s+\S+/gi, '$1 [Redacted]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s?]+)\?[^\s)"']+/gi, '$1?[Redacted]')
    .replace(
      /((?:password|key[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)[^,\s}"']+/gi,
      '$1[Redacted]',
    );

  const configuredSecrets = [
    env.KEY_SECRET,
    env.APPLICATION_SECRET,
    env.MAILGUN_API_KEY,
    env.GEOCODING_API_KEY,
    env.REDIS_PASSWORD,
  ].filter((value): value is string => Boolean(value && value.length >= 4));
  for (const secret of configuredSecrets) {
    sanitized = sanitized.replaceAll(secret, '[Redacted]');
  }
  return sanitized;
};

type SerializedError = {
  type: string;
  message?: string;
  code?: string | number;
  status_code?: number;
};

export const serializeError = (error: unknown): SerializedError => {
  if (!(error instanceof Error)) {
    return { type: 'UnknownError' };
  }

  const extended = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
  const code = typeof extended.code === 'string' || typeof extended.code === 'number' ? extended.code : undefined;
  const rawStatus = extended.statusCode ?? extended.status;
  const statusCode = typeof rawStatus === 'number' ? rawStatus : undefined;
  return {
    type: error.name,
    message: redactSensitiveText(error.message),
    ...(code !== undefined && { code }),
    ...(statusCode !== undefined && { status_code: statusCode }),
  };
};

const baseLogger = pino(
  {
    level: env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACTED_FIELDS, remove: true },
    // Error messages from HTTP clients can contain response bodies, URLs, or headers.
    // Keep useful diagnostics while stripping credentials and query strings.
    serializers: {
      err: serializeError,
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

export const safeErrorFields = (
  error: unknown,
): { error_type: string; error_message?: string; error_code?: string | number; status_code?: number } => {
  const serialized = serializeError(error);
  return {
    error_type: serialized.type,
    ...(serialized.message !== undefined && { error_message: serialized.message }),
    ...(serialized.code !== undefined && { error_code: serialized.code }),
    ...(serialized.status_code !== undefined && { status_code: serialized.status_code }),
  };
};
