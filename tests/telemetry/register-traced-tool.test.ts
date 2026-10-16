import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { ATTR_AUTH_METHOD, ATTR_TOOL_NAME } from '../../src/telemetry/constants';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

declare global {
  var __otelTestMocks: {
    mockEnd: jest.Mock;
    mockSetAttribute: jest.Mock;
    mockSetStatus: jest.Mock;
    mockRecordException: jest.Mock;
    mockStartActiveSpan: jest.Mock;
  };
}

jest.mock('@opentelemetry/api', () => {
  const actual = jest.requireActual('@opentelemetry/api');
  const mockSpan = {
    end: jest.fn(),
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
  };
  const mockStartActiveSpan = jest.fn((_name: string, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan));

  globalThis.__otelTestMocks = {
    mockEnd: mockSpan.end,
    mockSetAttribute: mockSpan.setAttribute,
    mockSetStatus: mockSpan.setStatus,
    mockRecordException: mockSpan.recordException,
    mockStartActiveSpan,
  };

  return {
    ...actual,
    trace: {
      ...actual.trace,
      getTracer: () => ({
        startActiveSpan: mockStartActiveSpan,
      }),
    },
  };
});

const mockToolCallsAdd = jest.fn();
const mockToolErrorsAdd = jest.fn();
const mockToolDurationRecord = jest.fn();

jest.mock('../../src/telemetry/metrics', () => ({
  getToolMetrics: () => ({
    toolCallsTotal: { add: mockToolCallsAdd },
    toolErrorsTotal: { add: mockToolErrorsAdd },
    toolDurationMs: { record: mockToolDurationRecord },
    sinchApiDurationMs: { record: jest.fn() },
  }),
}));

/* eslint-disable @typescript-eslint/no-require-imports -- load after jest mocks are registered */
const { registerTracedTool } =
  require('../../src/telemetry/register-traced-tool') as typeof import('../../src/telemetry/register-traced-tool');
/* eslint-enable @typescript-eslint/no-require-imports */

const otelMocks = () => globalThis.__otelTestMocks;

beforeEach(() => {
  jest.clearAllMocks();
  resetMockEnv();
});

test('registerTracedTool wraps handler with span attributes and records success metrics', async () => {
  mockEnv.PROJECT_ID = 'project-123';
  mockEnv.KEY_ID = 'key-id';
  mockEnv.KEY_SECRET = 'key-secret';

  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

  registerTracedTool(server, 'test-tool', { description: 'A test tool' }, handler);

  const registeredTool = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (...args: unknown[]) => unknown }>;
    }
  )._registeredTools['test-tool'];
  const result = await registeredTool.handler({}, {} as never);

  expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
  expect(otelMocks().mockStartActiveSpan).toHaveBeenCalledWith('mcp.tool/test-tool', expect.any(Function));
  expect(otelMocks().mockSetAttribute).toHaveBeenCalledWith(ATTR_TOOL_NAME, 'test-tool');
  expect(otelMocks().mockSetAttribute).toHaveBeenCalledWith(ATTR_AUTH_METHOD, 'oauth2_project_credentials');
  expect(otelMocks().mockSetAttribute).toHaveBeenCalledWith('project.id', 'project-123');
  expect(otelMocks().mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
  expect(mockToolCallsAdd).toHaveBeenCalledWith(1, {
    'tool.name': 'test-tool',
    status: 'success',
  });
  expect(mockToolDurationRecord).toHaveBeenCalled();
  expect(otelMocks().mockEnd).toHaveBeenCalled();
});

test('registerTracedTool records error metrics when handler throws', async () => {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const handler = jest.fn().mockRejectedValue(new Error('boom'));

  registerTracedTool(server, 'failing-tool', { description: 'Fails' }, handler);

  const registeredTool = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (...args: unknown[]) => unknown }>;
    }
  )._registeredTools['failing-tool'];

  await expect(registeredTool.handler({} as never, {} as never)).rejects.toThrow('boom');

  expect(otelMocks().mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
  expect(otelMocks().mockRecordException).toHaveBeenCalled();
  expect(mockToolCallsAdd).toHaveBeenCalledWith(1, {
    'tool.name': 'failing-tool',
    status: 'error',
  });
  expect(mockToolErrorsAdd).toHaveBeenCalledWith(1, {
    'tool.name': 'failing-tool',
    'error.type': 'Error',
  });
});

test('registerTracedTool records an isError result as an error and returns it unchanged', async () => {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const errorResult = { content: [{ type: 'text', text: '{"success":false}' }], isError: true };
  const handler = jest.fn().mockResolvedValue(errorResult);

  registerTracedTool(server, 'error-result-tool', { description: 'Returns an error result' }, handler);

  const registeredTool = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (...args: unknown[]) => unknown }>;
    }
  )._registeredTools['error-result-tool'];
  const result = await registeredTool.handler({} as never, {} as never);

  expect(result).toBe(errorResult);
  expect(otelMocks().mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
  expect(otelMocks().mockSetStatus).not.toHaveBeenCalledWith({ code: SpanStatusCode.OK });
  expect(otelMocks().mockRecordException).not.toHaveBeenCalled();
  expect(mockToolCallsAdd).toHaveBeenCalledTimes(1);
  expect(mockToolCallsAdd).toHaveBeenCalledWith(1, {
    'tool.name': 'error-result-tool',
    status: 'error',
  });
  expect(mockToolErrorsAdd).toHaveBeenCalledWith(1, {
    'tool.name': 'error-result-tool',
    'error.type': 'ToolResultError',
  });
  expect(mockToolDurationRecord).toHaveBeenCalled();
  expect(otelMocks().mockEnd).toHaveBeenCalled();
});

test('registerTracedTool treats isError: false as a success', async () => {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], isError: false });

  registerTracedTool(server, 'ok-tool', { description: 'Succeeds' }, handler);

  const registeredTool = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (...args: unknown[]) => unknown }>;
    }
  )._registeredTools['ok-tool'];
  await registeredTool.handler({} as never, {} as never);

  expect(otelMocks().mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
  expect(mockToolCallsAdd).toHaveBeenCalledWith(1, { 'tool.name': 'ok-tool', status: 'success' });
  expect(mockToolErrorsAdd).not.toHaveBeenCalled();
});

const callTool = async (name: string, toolResult: unknown) => {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  registerTracedTool(server, name, { description: name }, jest.fn().mockResolvedValue(toolResult));
  const registeredTool = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (...args: unknown[]) => unknown }>;
    }
  )._registeredTools[name];
  return registeredTool.handler({} as never, {} as never);
};

test('registerTracedTool flags a success:false JSON result with isError and records an error', async () => {
  const text = JSON.stringify({ success: false, error: 'boom' });

  const result = await callTool('json-failure-tool', { role: 'assistant', content: [{ type: 'text', text }] });

  expect(result).toEqual({ role: 'assistant', content: [{ type: 'text', text }], isError: true });
  expect(otelMocks().mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
  expect(mockToolCallsAdd).toHaveBeenCalledWith(1, { 'tool.name': 'json-failure-tool', status: 'error' });
  expect(mockToolErrorsAdd).toHaveBeenCalledWith(1, {
    'tool.name': 'json-failure-tool',
    'error.type': 'ToolResultError',
  });
});

test.each([
  ['success:true JSON', JSON.stringify({ success: true, data: [] })],
  ['nested success:false', JSON.stringify({ success: true, data: { success: false } })],
  ['plain text', 'Message sent'],
])('registerTracedTool leaves a %s result as a success', async (_label, text) => {
  const toolResult = { content: [{ type: 'text', text }] };

  const result = await callTool('ok-json-tool', toolResult);

  expect(result).toBe(toolResult);
  expect(otelMocks().mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
  expect(mockToolErrorsAdd).not.toHaveBeenCalled();
});

test('isTelemetryEnabled returns false without OTEL_EXPORTER_OTLP_ENDPOINT', () => {
  mockEnv.OTEL_EXPORTER_OTLP_ENDPOINT = undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isTelemetryEnabled } = require('../../src/telemetry/config');
  expect(isTelemetryEnabled()).not.toBeTruthy();
});

test('isTelemetryEnabled returns true when OTEL_EXPORTER_OTLP_ENDPOINT is set', () => {
  mockEnv.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4317';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isTelemetryEnabled } = require('../../src/telemetry/config');
  expect(isTelemetryEnabled()).toBeTruthy();
});
