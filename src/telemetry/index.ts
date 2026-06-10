import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { version as packageVersion } from '../../package.json';
import { isTelemetryEnabled } from './config';

let sdk: NodeSDK | undefined;

export const initTelemetry = (): NodeSDK | undefined => {
  if (!isTelemetryEnabled()) {
    return undefined;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'sinch-mcp-server';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      'service.version': packageVersion,
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  return sdk;
};

export const shutdownTelemetry = async (): Promise<void> => {
  await sdk?.shutdown();
};

initTelemetry();
