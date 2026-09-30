import type { Resource } from '@opentelemetry/resources';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({ start: jest.fn(), shutdown: jest.fn() })),
}));
jest.mock('@opentelemetry/exporter-trace-otlp-grpc', () => ({ OTLPTraceExporter: jest.fn() }));
jest.mock('@opentelemetry/exporter-metrics-otlp-grpc', () => ({ OTLPMetricExporter: jest.fn() }));

type NodeSDKMock = { NodeSDK: jest.Mock };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NodeSDK } = require('@opentelemetry/sdk-node') as NodeSDKMock;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initTelemetry } = require('../../src/telemetry') as { initTelemetry: () => unknown };

const enableTelemetry = (env: typeof mockEnv = mockEnv): void => {
  env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4317';
  env.OTEL_ENV = 'staging';
};

// Loads a module in a fresh registry, with telemetry configured, and reports whether that
// load started the SDK. The env and NodeSDK are required by the same (mocked) paths the code
// under test uses, so they are the instances it sees.
const startsSdkOnImport = (modulePath: string): boolean => {
  let called = false;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const isolatedEnv = require('../../src/env') as { env: typeof mockEnv };
    enableTelemetry(isolatedEnv.env);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const isolated = require('@opentelemetry/sdk-node') as NodeSDKMock;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(modulePath);
    called = isolated.NodeSDK.mock.calls.length > 0;
  });
  return called;
};

beforeEach(() => {
  resetMockEnv();
  NodeSDK.mockClear();
});

test('initTelemetry is a no-op without OTEL_EXPORTER_OTLP_ENDPOINT, even without OTEL_ENV', () => {
  expect(initTelemetry()).toBeUndefined();
  expect(NodeSDK).not.toHaveBeenCalled();
});

test('initTelemetry refuses to start when telemetry is on and OTEL_ENV is unset', () => {
  mockEnv.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4317';

  expect(() => initTelemetry()).toThrow(/OTEL_ENV is not set/);
  expect(NodeSDK).not.toHaveBeenCalled();
});

test('initTelemetry exports OTEL_ENV as deployment.environment.name', () => {
  enableTelemetry();
  mockEnv.OTEL_SERVICE_NAME = 'sinch-mcp-server-agent.mcp-messaging';

  initTelemetry();

  expect(NodeSDK).toHaveBeenCalledTimes(1);
  const { resource } = NodeSDK.mock.calls[0][0] as { resource: Resource };
  expect(resource.attributes).toMatchObject({
    'service.name': 'sinch-mcp-server-agent.mcp-messaging',
    'deployment.environment.name': 'staging',
  });
  expect(resource.attributes).not.toHaveProperty('deployment.environment');
});

test('importing the telemetry module does not start the SDK', () => {
  expect(startsSdkOnImport('../../src/telemetry')).toBeFalse();
});

test('the stdio entrypoint never starts the SDK, even with telemetry configured', () => {
  expect(startsSdkOnImport('../../src/index')).toBeFalse();
});

// Also proves the helper sees the configured env, so the two `false` cases above are real.
test('the HTTP entrypoint starts the SDK when telemetry is configured', () => {
  expect(startsSdkOnImport('../../src/http')).toBeTrue();
});
