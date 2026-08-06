import http from 'http';
import type { AddressInfo } from 'net';

jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { createHttpApp } from '../src/http';
import { getSessionStoreClientForTests, resetSessionStoreClientForTests } from '../src/session-store';

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
  });

  afterEach(async () => {
    resetSessionStoreClientForTests();
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

  it('opens a standalone SSE stream on GET for a valid session', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const initResponse = await post(baseUrl, initializeBody);
      const sessionId = initResponse.headers.get('mcp-session-id')!;

      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: 'Bearer test-http-key',
          'Mcp-Session-Id': sessionId,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      await response.body?.cancel();
    } finally {
      await close();
    }
  });

  it('rejects GET without a valid session id', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: { Accept: 'text/event-stream', Authorization: 'Bearer test-http-key' },
      });

      expect(response.status).toBe(400);
    } finally {
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
      const body = await parseJsonRpcError(response);
      expect(body.error.code).toBe(-32003);
    } finally {
      await close();
    }
  });
});
