export const isTelemetryEnabled = (): boolean =>
  Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
