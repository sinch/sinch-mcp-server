export type MockServerEnv = {
  PROJECT_ID?: string;
  KEY_ID?: string;
  KEY_SECRET?: string;
  CONVERSATION_APP_ID?: string;
  CONVERSATION_REGION?: 'us' | 'eu' | 'br';
  DEFAULT_SMS_ORIGINATOR?: string;
  GEOCODING_API_KEY?: string;
  APPLICATION_KEY?: string;
  APPLICATION_SECRET?: string;
  CALLING_LINE_IDENTIFICATION?: string;
  MAILGUN_DOMAIN?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_SENDER_ADDRESS?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_SERVICE_NAME?: string;
  OTEL_PROPAGATORS?: string;
  LOG_LEVEL?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
};

export const mockEnv: MockServerEnv = {};

export const env = mockEnv;

export function resetMockEnv(): void {
  for (const key of Object.keys(mockEnv) as (keyof MockServerEnv)[]) {
    delete mockEnv[key];
  }
}
