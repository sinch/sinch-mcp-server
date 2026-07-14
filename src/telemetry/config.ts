import { env } from '../env';

export const isTelemetryEnabled = (): boolean =>
  Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT);
