import http from 'node:http';
import type { AddressInfo } from 'net';

jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { clearAuthModeForTests } from '../src/auth/auth-mode';
import { clearHttpCredentialSourceForTests, getHttpCredentialSource } from '../src/auth/http-credential-mode';
import { mockEnv, resetMockEnv, type MockServerEnv } from '../src/__mocks__/env';
import { createHttpApp, main, waitForListening } from '../src/http';
import { getSessionStoreClientForTests, resetSessionStoreClientForTests } from '../src/session-store';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const ACCEPT_HEADER = 'application/json, text/event-stream';

const listen = async (
  app: ReturnType<typeof createHttpApp>,
): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> => {
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};

/** Response bodies are SSE-framed (`event: message\ndata: {...}\n\n`) — pull out the JSON-RPC payload. */
const parseSseJsonRpc = (
  text: string,
): { jsonrpc: '2.0'; id?: unknown; result?: unknown; error?: { code: number; message: string } } => {
  const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
  if (!dataLine) {
    throw new Error(`No SSE data line found in response body: ${text}`);
  }
  return JSON.parse(dataLine.slice('data: '.length));
};

type JsonRpcErrorBody = { jsonrpc: '2.0'; id: unknown; error: { code: number; message: string } };

const parseJsonRpcError = async (response: Response): Promise<JsonRpcErrorBody> =>
  (await response.json()) as JsonRpcErrorBody;

const post = (baseUrl: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: ACCEPT_HEADER,
      Authorization: 'Bearer test-http-key',
      ...headers,
    },
    body: JSON.stringify(body),
  });

const initializeBody = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  },
};

const toolsListBody = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };

describe('HTTP MCP session handling (Redis-backed)', () => {
  const originalApiKey = process.env.MCP_API_KEY;

  beforeEach(() => {
    process.env.MCP_API_KEY = 'test-http-key';
    mockEnv.REDIS_HOST = '127.0.0.1';
    mockEnv.REDIS_PORT = '6379';
  });

  afterEach(async () => {
    resetSessionStoreClientForTests();
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = undefined;
    if (originalApiKey === undefined) {
      delete process.env.MCP_API_KEY;
    } else {
      process.env.MCP_API_KEY = originalApiKey;
    }
  });

  it('issues a session on initialize and accepts a follow-up request handled by a different app instance (cross-pod)', async () => {
    const podA = await listen(createHttpApp());
    const podB = await listen(createHttpApp());
    try {
      const initResponse = await post(podA.baseUrl, initializeBody);
      expect(initResponse.status).toBe(200);
      const sessionId = initResponse.headers.get('mcp-session-id');
      expect(sessionId).toBeTruthy();

      const followUpResponse = await post(podB.baseUrl, toolsListBody, { 'Mcp-Session-Id': sessionId! });
      expect(followUpResponse.status).toBe(200);
      const body = parseSseJsonRpc(await followUpResponse.text());
      expect(body.error).toBeUndefined();
      expect(body.result).toBeDefined();
    } finally {
      await podA.close();
      await podB.close();
    }
  });

  it('rejects an initialize request that already carries an Mcp-Session-Id header', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await post(baseUrl, initializeBody, { 'Mcp-Session-Id': 'some-existing-session' });
      expect(response.status).toBe(400);
      const body = await parseJsonRpcError(response);
      expect(body.error.code).toBe(-32600);
    } finally {
      await close();
    }
  });

  it('returns 404/-32001 for an unknown session id', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await post(baseUrl, toolsListBody, { 'Mcp-Session-Id': 'does-not-exist' });
      expect(response.status).toBe(404);
      const body = await parseJsonRpcError(response);
      expect(body.error).toEqual({ code: -32001, message: 'Session not found' });
    } finally {
      await close();
    }
  });

  it('deletes a session so it can no longer be used', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const initResponse = await post(baseUrl, initializeBody);
      const sessionId = initResponse.headers.get('mcp-session-id')!;

      const deleteResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-http-key', 'Mcp-Session-Id': sessionId },
      });
      expect(deleteResponse.status).toBe(200);

      const followUpResponse = await post(baseUrl, toolsListBody, { 'Mcp-Session-Id': sessionId });
      expect(followUpResponse.status).toBe(404);
    } finally {
      await close();
    }
  });

  it('rejects GET with 405 — server-initiated notifications are unsupported', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: { Accept: 'text/event-stream', Authorization: 'Bearer test-http-key' },
      });

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST, DELETE');
      const body = await parseJsonRpcError(response);
      expect(body.error.code).toBe(-32000);
    } finally {
      await close();
    }
  });

  it('closes the per-request transport once the response finishes', async () => {
    const closeSpy = jest.spyOn(StreamableHTTPServerTransport.prototype, 'close');
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const initResponse = await post(baseUrl, initializeBody);
      expect(initResponse.status).toBe(200);

      // res 'close' fires once the socket is fully done with the response; give it a tick.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      closeSpy.mockRestore();
      await close();
    }
  });

  it('returns 503/-32003 when the session store is unreachable', async () => {
    const client = getSessionStoreClientForTests();
    jest.spyOn(client, 'set').mockRejectedValue(new Error('connection refused'));

    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await post(baseUrl, initializeBody);
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('2');
      const body = await parseJsonRpcError(response);
      expect(body.error.code).toBe(-32003);
    } finally {
      await close();
    }
  });

  it('returns 400 when no session id is provided and the body is not an initialize request', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await post(baseUrl, { jsonrpc: '2.0', method: 'ping', id: 1 });
      expect(response.status).toBe(400);
      const body = await parseJsonRpcError(response);
      expect(body.error.message).toBe('Bad Request: No valid session ID provided');
    } finally {
      await close();
    }
  });

  it('accepts a JSON-RPC batch array containing an initialize request', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await post(baseUrl, [initializeBody]);
      expect(response.status).not.toBe(400);
      expect(response.status).not.toBe(503);
    } finally {
      await close();
    }
  });

  it('returns 500 when the session transport throws while handling a request', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const initResponse = await post(baseUrl, initializeBody);
      const sessionId = initResponse.headers.get('mcp-session-id')!;

      const handleRequestSpy = jest
        .spyOn(StreamableHTTPServerTransport.prototype, 'handleRequest')
        .mockRejectedValueOnce(new Error('boom'));

      try {
        const response = await post(baseUrl, toolsListBody, { 'Mcp-Session-Id': sessionId });
        expect(response.status).toBe(500);
        const body = await parseJsonRpcError(response);
        expect(body.error.message).toBe('Internal server error');
      } finally {
        handleRequestSpy.mockRestore();
      }
    } finally {
      await close();
    }
  });

  it('creates a session on initialize and serves subsequent requests for that session (real MCP client)', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const clientTransport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
        requestInit: { headers: { Authorization: 'Bearer test-http-key' } },
      });
      const client = new Client({ name: 'test-client', version: '1.0.0' });

      await client.connect(clientTransport);
      expect(clientTransport.sessionId).toBeDefined();

      const { tools } = await client.listTools();
      expect(Array.isArray(tools)).toBeTrue();
      expect(tools.length).toBeGreaterThan(0);

      await clientTransport.terminateSession();
      await client.close();
    } finally {
      await close();
    }
  });
});

describe('main() startup', () => {
  const originalExit = process.exit;

  afterEach(() => {
    process.exit = originalExit;
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = undefined;
  });

  it('fails fast with a clear error when REDIS_HOST is not set', async () => {
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = '6379';
    const exitSpy = jest.fn() as unknown as typeof process.exit;
    process.exit = exitSpy;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await main();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_HOST not set'));

    errorSpy.mockRestore();
  });

  it('fails fast with a clear error when REDIS_PORT is not set', async () => {
    mockEnv.REDIS_HOST = '127.0.0.1';
    mockEnv.REDIS_PORT = undefined;
    const exitSpy = jest.fn() as unknown as typeof process.exit;
    process.exit = exitSpy;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await main();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_PORT not set'));

    errorSpy.mockRestore();
  });

  it('fails fast listing both when neither REDIS_HOST nor REDIS_PORT is set', async () => {
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = undefined;
    const exitSpy = jest.fn() as unknown as typeof process.exit;
    process.exit = exitSpy;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await main();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_HOST, REDIS_PORT not set'));

    errorSpy.mockRestore();
  });
});

describe('createHttpApp startup validation', () => {
  const originalMcpApiKey = process.env.MCP_API_KEY;
  const originalMcpApiKeys = process.env.MCP_API_KEYS;

  beforeEach(() => {
    resetMockEnv();
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_API_KEYS;
  });

  afterEach(() => {
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
  });

  afterAll(() => {
    if (originalMcpApiKey !== undefined) {
      process.env.MCP_API_KEY = originalMcpApiKey;
    }
    if (originalMcpApiKeys !== undefined) {
      process.env.MCP_API_KEYS = originalMcpApiKeys;
    }
  });

  test('throws in multi-tenant mode when CONVERSATION_REGION is not set', () => {
    expect(() => createHttpApp()).toThrow(
      'The server is starting in multi-tenant mode because neither MCP_API_KEY nor MCP_API_KEYS is set. ' +
        'In multi-tenant mode, the CONVERSATION_REGION environment variable is required',
    );
  });

  test('starts in multi-tenant mode when CONVERSATION_REGION and MCP_AUTH_MODE are set', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    expect(() => createHttpApp()).not.toThrow();
    expect(getHttpCredentialSource()).toBe('request-header');
  });

  test('throws in multi-tenant mode when MCP_AUTH_MODE is not set', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    expect(() => createHttpApp()).toThrow(
      'In multi-tenant mode, the MCP_AUTH_MODE environment variable is required ' +
        '(one of: client-credentials, sinchid-agent)',
    );
  });

  test('throws in multi-tenant mode when MCP_AUTH_MODE is not recognised', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.MCP_AUTH_MODE = 'sinchid_agent' as MockServerEnv['MCP_AUTH_MODE'];
    expect(() => createHttpApp()).toThrow('In multi-tenant mode, the MCP_AUTH_MODE environment variable is required');
  });

  test('accepts sinchid-agent as an auth mode', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    expect(() => createHttpApp()).not.toThrow();
  });

  test('does not require CONVERSATION_REGION or MCP_AUTH_MODE in single-tenant mode', () => {
    process.env.MCP_API_KEY = 'test-api-key';
    expect(() => createHttpApp()).not.toThrow();
    expect(getHttpCredentialSource()).toBe('env');
  });
});

describe('multi-tenant auth mode enforcement', () => {
  const originalMcpApiKey = process.env.MCP_API_KEY;
  const originalMcpApiKeys = process.env.MCP_API_KEYS;

  const credentialsBlob = Buffer.from('project-1:key-1:secret-1').toString('base64');
  const encodeSegment = (payload: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sinchIdToken = `Bearer ${encodeSegment({ alg: 'RS256' })}.${encodeSegment({ sub: 'user-1' })}.sig`;

  beforeEach(() => {
    resetMockEnv();
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_API_KEYS;
    mockEnv.CONVERSATION_REGION = 'eu';
  });

  afterEach(() => {
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
  });

  afterAll(() => {
    if (originalMcpApiKey !== undefined) {
      process.env.MCP_API_KEY = originalMcpApiKey;
    }
    if (originalMcpApiKeys !== undefined) {
      process.env.MCP_API_KEYS = originalMcpApiKeys;
    }
  });

  test('client-credentials deployment rejects x-agent-id with 401 and a challenge', async () => {
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await post(baseUrl, initializeBody, { 'x-agent-id': 'order-42' });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('Bearer realm="sinch-mcp"');
      expect(await response.json()).toMatchObject({ error: 'invalid_token' });
    } finally {
      await close();
    }
  });

  test('sinchid-agent deployment rejects a base64 credential blob with 401 and a challenge', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await post(baseUrl, initializeBody, { 'x-sinch-credentials': credentialsBlob });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('Bearer realm="sinch-mcp"');
      expect(await response.json()).toMatchObject({ error: 'invalid_token' });
    } finally {
      await close();
    }
  });

  test('client-credentials deployment accepts its own auth shape', async () => {
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await post(baseUrl, initializeBody, { 'x-sinch-credentials': credentialsBlob });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBeTruthy();
    } finally {
      await close();
    }
  });

  test('sinchid-agent deployment rejects a request with no Authorization token', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: ACCEPT_HEADER, 'x-agent-id': 'order-42' },
        body: JSON.stringify(initializeBody),
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer realm="sinch-mcp"');
      expect(await response.json()).toEqual({
        error: 'Unauthorized',
        error_description: 'Missing SinchID access token in the Authorization header',
      });
    } finally {
      await close();
    }
  });

  test('sinchid-agent deployment accepts a SinchID token with x-agent-id', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await post(baseUrl, initializeBody, {
        Authorization: sinchIdToken,
        'x-agent-id': 'order-42',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBeTruthy();
    } finally {
      await close();
    }
  });

  test('health probes stay reachable regardless of auth shape', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await fetch(`${baseUrl}/health/live`, {
        headers: { 'x-sinch-credentials': credentialsBlob },
      });

      expect(response.status).toBe(200);
    } finally {
      await close();
    }
  });
});

describe('waitForListening', () => {
  it('resolves when the server is already listening', async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

    await expect(waitForListening(server)).resolves.toBeUndefined();

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
