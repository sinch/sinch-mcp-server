import { createEnv, type StandardSchemaV1 } from '@t3-oss/env-core';
import { config } from 'dotenv';
import { z } from 'zod';

config();

export const env = createEnv({
  server: {
    PROJECT_ID: z.string().optional(),
    KEY_ID: z.string().optional(),
    KEY_SECRET: z.string().optional(),
    CONVERSATION_APP_ID: z.string().optional(),
    CONVERSATION_REGION: z.enum(['us', 'eu', 'br']).optional(),
    DEFAULT_SMS_ORIGINATOR: z.string().optional(),
    GEOCODING_API_KEY: z.string().optional(),
    APPLICATION_KEY: z.string().optional(),
    APPLICATION_SECRET: z.string().optional(),
    CALLING_LINE_IDENTIFICATION: z.string().optional(),
    MAILGUN_DOMAIN: z.string().optional(),
    MAILGUN_API_KEY: z.string().optional(),
    MAILGUN_SENDER_ADDRESS: z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_PROPAGATORS: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  },
  runtimeEnvStrict: {
    PROJECT_ID: process.env.PROJECT_ID,
    KEY_ID: process.env.KEY_ID,
    KEY_SECRET: process.env.KEY_SECRET,
    CONVERSATION_APP_ID: process.env.CONVERSATION_APP_ID,
    CONVERSATION_REGION: process.env.CONVERSATION_REGION,
    DEFAULT_SMS_ORIGINATOR: process.env.DEFAULT_SMS_ORIGINATOR,
    GEOCODING_API_KEY: process.env.GEOCODING_API_KEY,
    APPLICATION_KEY: process.env.APPLICATION_KEY,
    APPLICATION_SECRET: process.env.APPLICATION_SECRET,
    CALLING_LINE_IDENTIFICATION: process.env.CALLING_LINE_IDENTIFICATION,
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
    MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
    MAILGUN_SENDER_ADDRESS: process.env.MAILGUN_SENDER_ADDRESS,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    OTEL_PROPAGATORS: process.env.OTEL_PROPAGATORS,
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
  emptyStringAsUndefined: true,
  onValidationError: (issues: readonly StandardSchemaV1.Issue[]) => {
    console.error('Invalid environment variables:', issues);
    throw new Error('Invalid environment variables');
  },
});

export type ServerEnv = typeof env;
