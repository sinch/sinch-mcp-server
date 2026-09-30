import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME, ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { version as packageVersion } from '../../package.json';
import { env } from '../env';
import { isTelemetryEnabled } from './config';

let sdk: NodeSDK | undefined;

export const initTelemetry = (): NodeSDK | undefined => {
  if (!isTelemetryEnabled()) {
    return undefined;
  }

  const serviceName = env.OTEL_SERVICE_NAME ?? 'sinch-mcp-server';
  const deploymentEnv = env.OTEL_ENV;

  // Telemetry is on, so it is exported somewhere: refuse to start rather than emit
  // spans and metrics that cannot be told apart per environment in Grafana.
  if (!deploymentEnv) {
    throw new Error(
      `OTEL_ENV is not set. OTEL_EXPORTER_OTLP_ENDPOINT is set, so OTEL_ENV must be 'production' or 'staging'.`,
    );
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      'service.version': packageVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: deploymentEnv,
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
  });

  sdk.start();
  return sdk;
};

export const shutdownTelemetry = async (): Promise<void> => {
  await sdk?.shutdown();
};
