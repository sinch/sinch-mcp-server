/* global __ENV */
import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const baseUrl = __ENV.MCP_BASE_URL;
const authorization = __ENV.MCP_AUTHORIZATION;
const toolName = __ENV.MCP_TOOL_NAME;
const toolArguments = JSON.parse(__ENV.MCP_TOOL_ARGUMENTS || '{}');

if (!baseUrl || !authorization) {
  fail('MCP_BASE_URL and MCP_AUTHORIZATION are required');
}

const initializeLatency = new Trend('mcp_initialize_duration', true);
const requestLatency = new Trend('mcp_request_duration', true);
const toolLatency = new Trend('mcp_tool_duration', true);
const connectLatency = new Trend('mcp_connect_duration', true);
const serverWaitLatency = new Trend('mcp_server_wait_duration', true);
const receiveLatency = new Trend('mcp_receive_duration', true);

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.MCP_RATE || 10),
      timeUnit: '1s',
      duration: __ENV.MCP_DURATION || '2m',
      preAllocatedVUs: Number(__ENV.MCP_PREALLOCATED_VUS || 20),
      maxVUs: Number(__ENV.MCP_MAX_VUS || 100),
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    mcp_request_duration: ['p(95)<1000'],
    ...(toolName ? { mcp_tool_duration: ['p(95)<3000'] } : {}),
  },
};

const headers = {
  Authorization: authorization,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

const requestBody = (id) =>
  toolName
    ? {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: toolName, arguments: toolArguments },
      }
    : { jsonrpc: '2.0', id, method: 'tools/list', params: {} };

const parseSsePayload = (response) => {
  const dataLine = response.body.split('\n').find((line) => line.startsWith('data: '));
  if (!dataLine) {
    return undefined;
  }
  try {
    return JSON.parse(dataLine.slice('data: '.length));
  } catch {
    return undefined;
  }
};

const toolResultSucceeded = (payload) => {
  if (!payload || payload.error || payload.result?.isError) {
    return false;
  }
  const text = payload.result?.content?.find((item) => item.type === 'text')?.text;
  if (!text) {
    return true;
  }
  try {
    return JSON.parse(text).success !== false;
  } catch {
    return true;
  }
};

let sessionId;
let requestId = 1;

export default function () {
  if (!sessionId) {
    const response = http.post(
      `${baseUrl}/mcp`,
      JSON.stringify({
        jsonrpc: '2.0',
        id: requestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'k6', version: '1.0.0' },
        },
      }),
      { headers, tags: { operation: 'initialize' } },
    );
    initializeLatency.add(response.timings.duration);
    check(response, {
      'initialize succeeds': (result) => result.status === 200,
      'session id returned': (result) => Boolean(result.headers['Mcp-Session-Id']),
    });
    sessionId = response.headers['Mcp-Session-Id'];
    if (!sessionId) {
      return;
    }
  }

  const operation = toolName ? `tool:${toolName}` : 'tools/list';
  const response = http.post(`${baseUrl}/mcp`, JSON.stringify(requestBody(requestId++)), {
    headers: { ...headers, 'Mcp-Session-Id': sessionId },
    tags: { operation },
  });
  requestLatency.add(response.timings.duration);
  connectLatency.add(
    response.timings.blocked + response.timings.connecting + response.timings.tls_handshaking,
  );
  serverWaitLatency.add(response.timings.waiting);
  receiveLatency.add(response.timings.receiving);
  if (toolName) {
    toolLatency.add(response.timings.duration, { tool: toolName });
  }
  const payload = parseSsePayload(response);
  check(response, {
    'MCP HTTP request succeeds': (result) => result.status >= 200 && result.status < 300,
    'MCP JSON-RPC request succeeds': () => Boolean(payload) && !payload.error,
    ...(toolName ? { 'MCP tool result succeeds': () => toolResultSucceeded(payload) } : {}),
  });
}
