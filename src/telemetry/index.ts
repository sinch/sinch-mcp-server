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
import { ATTR_SINCH_API_SERVICE } from './constants';
import { getToolMetrics } from './metrics';

let sdk: NodeSDK | undefined;

const sinchApiService = (origin: string): string | undefined => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (!hostname.endsWith('.sinch.com')) {
      return undefined;
    }
    return hostname;
  } catch {
    return undefined;
  }
};

type HttpClientRequestLike = {
  getHeader?: (name: string) => unknown;
  path?: string;
  protocol?: string;
};

export const buildSanitizedHttpUrl = (
  request: HttpClientRequestLike,
): { origin: string; path: string; sanitizedUrl: string } | undefined => {
  const host = request.getHeader?.('host');
  const protocol = request.protocol;
  if (!host || !protocol) {
    return undefined;
  }
  const normalizedProtocol = protocol.endsWith(':') ? protocol : `${protocol}:`;
  const origin = `${normalizedProtocol}//${String(host)}`;
  const path = request.path?.split('?')[0] ?? '/';
  return { origin, path, sanitizedUrl: `${origin}${path}` };
};

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

  const sinchRequestStarts = new WeakMap<object, number>();
  const httpSinchRequestStarts = new WeakMap<object, { startedAt: number; service: string }>();
  const httpInstrumentation = new HttpInstrumentation({
    requestHook: (span, request) => {
      const sanitized = buildSanitizedHttpUrl(request as HttpClientRequestLike);
      if (!sanitized) {
        return;
      }
      // Query strings can carry credentials (for example GEOCODING_API_KEY).
      span.setAttribute('url.full', sanitized.sanitizedUrl);
      span.setAttribute('http.url', sanitized.sanitizedUrl);
      span.setAttribute('http.target', sanitized.path);
      span.setAttribute('url.path', sanitized.path);
      span.setAttribute('url.query', '');
      const service = sinchApiService(sanitized.origin);
      if (!service) {
        return;
      }
      span.setAttribute(ATTR_SINCH_API_SERVICE, service);
      httpSinchRequestStarts.set(span, { startedAt: performance.now(), service });
    },
    responseHook: (span, response) => {
      const request = httpSinchRequestStarts.get(span);
      if (!request) {
        return;
      }
      const statusCode = (response as { statusCode?: number }).statusCode ?? 0;
      getToolMetrics().sinchApiDurationMs.record(performance.now() - request.startedAt, {
        service: request.service,
        status: statusCode >= 400 ? 'error' : 'success',
        status_code: statusCode,
      });
      httpSinchRequestStarts.delete(span);
    },
  });
  const undiciInstrumentation = new UndiciInstrumentation({
    startSpanHook: (request) => {
      const service = sinchApiService(request.origin);
      if (!service) {
        const path = request.path.split('?')[0];
        return {
          'url.full': `${request.origin}${path}`,
          'http.url': `${request.origin}${path}`,
          'http.target': path,
          'url.path': path,
          'url.query': '',
        };
      }
      sinchRequestStarts.set(request, performance.now());
      const path = request.path.split('?')[0];
      return {
        [ATTR_SINCH_API_SERVICE]: service,
        'url.full': `${request.origin}${path}`,
        'http.url': `${request.origin}${path}`,
        'http.target': path,
        'url.path': path,
        'url.query': '',
      };
    },
    responseHook: (span, { request, response }) => {
      const service = sinchApiService(request.origin);
      const startedAt = sinchRequestStarts.get(request);
      if (!service || startedAt === undefined) {
        return;
      }
      const status = response.statusCode >= 400 ? 'error' : 'success';
      span.setAttribute(ATTR_SINCH_API_SERVICE, service);
      getToolMetrics().sinchApiDurationMs.record(performance.now() - startedAt, {
        service,
        status,
        status_code: response.statusCode,
      });
      sinchRequestStarts.delete(request);
    },
  });

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
    instrumentations: [httpInstrumentation, undiciInstrumentation],
  });

  sdk.start();
  return sdk;
};

export const shutdownTelemetry = async (): Promise<void> => {
  await sdk?.shutdown();
};
