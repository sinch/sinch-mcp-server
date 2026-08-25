import http from 'http';
import type { AddressInfo } from 'net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { clearMaxMcpSessionsForTests, setMaxMcpSessionsForTests } from '../src/auth/http-session-limits';
import { SINCH_CREDENTIALS_HEADER } from '../src/auth/sinch-oauth-credentials';
import { clearSessionsForTests, createHttpApp, seedSessionForTests } from '../src/http';
import { mockEnv, resetMockEnv } from './helpers/mock-env';

const VALID_CREDENTIALS_HEADER = Buffer.from('proj:key:secret').toString('base64');

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const INITIALIZE_BODY = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  },
};

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

describe('MCP request routing', () => {
  let baseUrl: string;
  let close: () => Promise<void>;

  beforeEach(async () => {
    resetMockEnv();
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_API_KEYS;
    mockEnv.CONVERSATION_REGION = 'eu';
    clearMaxMcpSessionsForTests();
    clearSessionsForTests();
    ({ baseUrl, close } = await listen(createHttpApp()));
  });

  afterEach(async () => {
    await close();
    clearMaxMcpSessionsForTests();
    clearSessionsForTests();
  });

  it('creates a session on initialize and serves subsequent requests for that session', async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER } },
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await client.connect(transport);
    expect(transport.sessionId).toBeDefined();

    const { tools } = await client.listTools();
    expect(Array.isArray(tools)).toBeTrue();
    expect(tools.length).toBeGreaterThan(0);

    await transport.terminateSession();
    await client.close();
  });

  it('returns 401 and creates no session when X-Sinch-Credentials is missing on initialize', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain(SINCH_CREDENTIALS_HEADER);

    setMaxMcpSessionsForTests(1);
    const authedResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER },
      body: JSON.stringify(INITIALIZE_BODY),
    });
    expect(authedResponse.status).not.toBe(503);
  });

  it('returns 401 when X-Sinch-Credentials is missing on a request with an existing session id', async () => {
    seedSessionForTests('existing-session');

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'mcp-session-id': 'existing-session' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 404 when the mcp-session-id header does not match a known session', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });
    const withUnknownSession = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': 'does-not-exist',
        [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(withUnknownSession.status).toBe(404);
    const body = (await withUnknownSession.json()) as { error: { code: number; message: string } };
    expect(body.error.message).toBe('Session not found');

    // Sanity check: without a session id at all, the request is a 400, not a 404.
    expect(response.status).toBe(400);
  });

  it('returns 400 when no session id is provided and the body is not an initialize request', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe('Bad Request: No valid session ID provided');
  });

  it('accepts a JSON-RPC batch array containing an initialize request', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER,
      },
      body: JSON.stringify([INITIALIZE_BODY]),
    });

    expect(response.status).not.toBe(400);
    expect(response.status).not.toBe(503);
  });

  it('returns 503 when session capacity is reached on an initialize request', async () => {
    // MCP_MAX_SESSIONS <= 0 falls back to the default cap, so seed a session and cap at 1.
    setMaxMcpSessionsForTests(1);
    seedSessionForTests('existing-session');

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe('Service Unavailable: maximum number of MCP sessions reached');
  });

  it('returns 500 when the session transport throws while handling a request', async () => {
    seedSessionForTests('broken-session');

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': 'broken-session',
        [SINCH_CREDENTIALS_HEADER]: VALID_CREDENTIALS_HEADER,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe('Internal server error');
  });
});
