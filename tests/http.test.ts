import http from 'node:http';
import type { AddressInfo } from 'net';

jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { setAgentSecretManagerClientForTests } from '../src/auth/agent-secret-manager';
import { clearAuthModeForTests, getAuthMode } from '../src/auth/auth-mode';
import { clearHttpCredentialSourceForTests, getHttpCredentialSource } from '../src/auth/http-credential-mode';
import { MISSING_AGENT_CREDENTIALS_MESSAGE } from '../src/auth/resolve-sinch-oauth-credentials';
import { resetSinchIdJwtVerifierForTests } from '../src/auth/sinchid-jwt-verifier';
import { SINCH_ACCOUNT_ID_CLAIM, SINCH_GLOBAL_USER_ID_CLAIM, SINCH_PROJECT_ID_CLAIM } from '../src/auth/user-jwt';
import { mockEnv, resetMockEnv, type MockServerEnv } from '../src/__mocks__/env';
import { createHttpApp, main, waitForListening } from '../src/http';
import { getSessionStoreClientForTests, resetSessionStoreClientForTests } from '../src/session-store';
import { logger } from '../src/telemetry/logger';
import { generateUnpublishedKeyPair, startTestJwksServer, type TestJwksServer } from './helpers/jwks-server';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const ACCEPT_HEADER = 'application/json, text/event-stream';
const CREDENTIALS_BLOB = Buffer.from('project-1:key-1:secret-1').toString('base64');
const CREDENTIALS_HEADER = `Bearer ${CREDENTIALS_BLOB}`;
const secretManagerAccess = jest.fn();

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
      Authorization: CREDENTIALS_HEADER,
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
  beforeEach(() => {
    resetMockEnv();
    mockEnv.REDIS_HOST = '127.0.0.1';
    mockEnv.REDIS_PORT = '6379';
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    mockEnv.CONVERSATION_REGION = 'eu';
    secretManagerAccess.mockReset().mockResolvedValue([{ payload: { data: Buffer.from(CREDENTIALS_BLOB) } }]);
    setAgentSecretManagerClientForTests({
      getProjectId: jest.fn().mockResolvedValue('google-project'),
      accessSecretVersion: secretManagerAccess,
    });
  });

  afterEach(() => {
    setAgentSecretManagerClientForTests(undefined);
    resetSessionStoreClientForTests();
    resetMockEnv();
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
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
        headers: { Authorization: CREDENTIALS_HEADER, 'Mcp-Session-Id': sessionId },
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
        headers: { Accept: 'text/event-stream', Authorization: CREDENTIALS_HEADER },
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
        requestInit: { headers: { Authorization: CREDENTIALS_HEADER } },
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
  beforeEach(() => {
    resetMockEnv();
  });

  afterEach(() => {
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
  });

  test('throws when neither credentials nor MCP_AUTH_MODE are set', () => {
    expect(() => createHttpApp()).toThrow('MCP_AUTH_MODE is not set, so this is a single-tenant deployment');
  });

  // A typo must not degrade to single-tenant: that would silently drop inbound auth on an
  // endpoint whose only protection is the auth-mode middleware.
  test('throws when MCP_AUTH_MODE is set but not recognised, even with credentials available', () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid_agent' as MockServerEnv['MCP_AUTH_MODE'];
    mockEnv.PROJECT_ID = 'project-1';
    mockEnv.KEY_ID = 'key-1';
    mockEnv.KEY_SECRET = 'secret-1';

    expect(() => createHttpApp()).toThrow('MCP_AUTH_MODE=sinchid_agent is not a recognised mode');
  });

  test('throws in multi-tenant mode when CONVERSATION_REGION is not set', () => {
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    expect(() => createHttpApp()).toThrow('In multi-tenant mode, the CONVERSATION_REGION environment variable is');
  });

  test('starts in multi-tenant mode when CONVERSATION_REGION and MCP_AUTH_MODE are set', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    expect(() => createHttpApp()).not.toThrow();
    expect(getHttpCredentialSource()).toBe('request-header');
  });

  test('accepts sinchid-agent as an auth mode', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    mockEnv.SINCHID_JWT_ISSUER = 'https://issuer.example/';
    mockEnv.SINCHID_JWT_AUDIENCE = 'audience';
    mockEnv.SINCHID_JWT_JWKS_URI = 'https://issuer.example/jwks.json';
    expect(() => createHttpApp()).not.toThrow();
  });

  describe('sinchid-agent requires JWT verification config', () => {
    beforeEach(() => {
      mockEnv.CONVERSATION_REGION = 'eu';
      mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    });

    test('throws when SINCHID_JWT_ISSUER, SINCHID_JWT_AUDIENCE and SINCHID_JWT_JWKS_URI are all unset', () => {
      expect(() => createHttpApp()).toThrow(
        'MCP_AUTH_MODE=sinchid-agent requires SINCHID_JWT_ISSUER, SINCHID_JWT_AUDIENCE, SINCHID_JWT_JWKS_URI',
      );
    });

    test.each([['SINCHID_JWT_ISSUER'], ['SINCHID_JWT_AUDIENCE'], ['SINCHID_JWT_JWKS_URI']] as const)(
      'throws naming %s when only it is missing',
      (missing) => {
        mockEnv.SINCHID_JWT_ISSUER = 'https://issuer.example/';
        mockEnv.SINCHID_JWT_AUDIENCE = 'audience';
        mockEnv.SINCHID_JWT_JWKS_URI = 'https://issuer.example/jwks.json';
        mockEnv[missing] = undefined;

        expect(() => createHttpApp()).toThrow(missing);
      },
    );

    test('does not throw once all three are set', () => {
      mockEnv.SINCHID_JWT_ISSUER = 'https://issuer.example/';
      mockEnv.SINCHID_JWT_AUDIENCE = 'audience';
      mockEnv.SINCHID_JWT_JWKS_URI = 'https://issuer.example/jwks.json';

      expect(() => createHttpApp()).not.toThrow();
    });

    test('client-credentials mode does not require these vars', () => {
      mockEnv.MCP_AUTH_MODE = 'client-credentials';

      expect(() => createHttpApp()).not.toThrow();
    });
  });

  describe('single-tenant, selected by MCP_AUTH_MODE being unset', () => {
    const setServerCredentials = () => {
      mockEnv.PROJECT_ID = 'project-1';
      mockEnv.KEY_ID = 'key-1';
      mockEnv.KEY_SECRET = 'secret-1';
    };

    test('starts on the credential triple alone and resolves credentials from the environment', () => {
      setServerCredentials();

      expect(() => createHttpApp()).not.toThrow();
      expect(getHttpCredentialSource()).toBe('env');
      expect(getAuthMode()).toBeUndefined();
    });

    test('does not require CONVERSATION_REGION', () => {
      setServerCredentials();
      mockEnv.CONVERSATION_REGION = undefined;

      expect(() => createHttpApp()).not.toThrow();
    });

    test.each([['PROJECT_ID'], ['KEY_ID'], ['KEY_SECRET']] as const)(
      'refuses to start on a partial triple, with %s missing',
      (missing) => {
        setServerCredentials();
        mockEnv[missing] = undefined;

        expect(() => createHttpApp()).toThrow('single-tenant deployment, which requires');
        expect(() => createHttpApp()).toThrow(`${missing} missing`);
      },
    );
  });

  // MCP_AUTH_MODE is the selector and is read first, so a credential left in the environment —
  // a stale Secret key, a local .env carried into a container — cannot pull a deployed
  // multi-tenant server back onto one shared account.
  describe('MCP_AUTH_MODE takes precedence over the credential triple', () => {
    test.each([['client-credentials'], ['sinchid-agent']] as const)(
      'starts multi-tenant with MCP_AUTH_MODE=%s even when the full triple is set',
      (mode) => {
        mockEnv.PROJECT_ID = 'project-1';
        mockEnv.KEY_ID = 'key-1';
        mockEnv.KEY_SECRET = 'secret-1';
        mockEnv.CONVERSATION_REGION = 'eu';
        mockEnv.MCP_AUTH_MODE = mode;
        if (mode === 'sinchid-agent') {
          mockEnv.SINCHID_JWT_ISSUER = 'https://issuer.example/';
          mockEnv.SINCHID_JWT_AUDIENCE = 'audience';
          mockEnv.SINCHID_JWT_JWKS_URI = 'https://issuer.example/jwks.json';
        }

        expect(() => createHttpApp()).not.toThrow();
        expect(getHttpCredentialSource()).toBe('request-header');
        expect(getAuthMode()).toBe(mode);
      },
    );

    test('a partial triple is irrelevant once MCP_AUTH_MODE is set', () => {
      mockEnv.PROJECT_ID = 'project-1';
      mockEnv.CONVERSATION_REGION = 'eu';
      mockEnv.MCP_AUTH_MODE = 'client-credentials';

      expect(() => createHttpApp()).not.toThrow();
      expect(getHttpCredentialSource()).toBe('request-header');
    });

    test('still requires CONVERSATION_REGION, which the credentials cannot substitute for', () => {
      mockEnv.PROJECT_ID = 'project-1';
      mockEnv.KEY_ID = 'key-1';
      mockEnv.KEY_SECRET = 'secret-1';
      mockEnv.MCP_AUTH_MODE = 'client-credentials';

      expect(() => createHttpApp()).toThrow('In multi-tenant mode, the CONVERSATION_REGION environment variable is');
    });
  });
});

describe('auth mode enforcement', () => {
  const credentialsBlob = CREDENTIALS_BLOB;
  const ISSUER = 'https://issuer.example/';
  const AUDIENCE = 'https://agent-auth-api-test.sinch.com';
  const AGENT_ORDER_ID = '11111111-1111-4111-8111-111111111111';
  const AGENT_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
  let jwksServer: TestJwksServer;

  beforeAll(async () => {
    jwksServer = await startTestJwksServer();
  });

  afterAll(async () => {
    await jwksServer.close();
  });

  beforeEach(() => {
    resetMockEnv();
    resetSinchIdJwtVerifierForTests();
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.SINCHID_JWT_ISSUER = ISSUER;
    mockEnv.SINCHID_JWT_AUDIENCE = AUDIENCE;
    mockEnv.SINCHID_JWT_JWKS_URI = jwksServer.url;
    secretManagerAccess.mockReset().mockResolvedValue([{ payload: { data: Buffer.from(CREDENTIALS_BLOB) } }]);
    setAgentSecretManagerClientForTests({
      getProjectId: jest.fn().mockResolvedValue('google-project'),
      accessSecretVersion: secretManagerAccess,
    });
  });

  afterEach(() => {
    setAgentSecretManagerClientForTests(undefined);
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
  });

  test('client-credentials deployment ignores x-agent-id', async () => {
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await post(baseUrl, initializeBody, {
        Authorization: `Bearer ${credentialsBlob}`,
        'x-agent-id': 'order-42',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBeTruthy();
      expect(secretManagerAccess).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  test('sinchid-agent deployment rejects a base64 credential blob with 401 and a challenge', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await post(baseUrl, initializeBody, { Authorization: `Bearer ${credentialsBlob}` });

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
      const response = await post(baseUrl, initializeBody, { Authorization: `Bearer ${credentialsBlob}` });

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

  test('sinchid-agent deployment accepts a validly signed SinchID token with x-agent-id', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    secretManagerAccess.mockResolvedValue([
      {
        payload: {
          data: Buffer.from(Buffer.from(`${AGENT_PROJECT_ID}:key-1:secret-1`).toString('base64')),
        },
      },
    ]);
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const token = jwksServer.sign({
        iss: ISSUER,
        aud: AUDIENCE,
        sub: 'user-1',
        [SINCH_PROJECT_ID_CLAIM]: AGENT_PROJECT_ID,
        [SINCH_ACCOUNT_ID_CLAIM]: 'account-1',
        [SINCH_GLOBAL_USER_ID_CLAIM]: 'user-1',
        scope: 'openid',
      });
      const response = await post(baseUrl, initializeBody, {
        Authorization: `Bearer ${token}`,
        'x-agent-id': AGENT_ORDER_ID,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBeTruthy();
      expect(secretManagerAccess).toHaveBeenCalledWith(
        {
          name: `projects/google-project/secrets/sinch-agent-m2m_${AGENT_ORDER_ID}_${AGENT_PROJECT_ID}/versions/latest`,
        },
        { timeout: 3_000 },
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: AGENT_PROJECT_ID,
          account_id: 'account-1',
          global_user_id: 'user-1',
          scope: 'openid',
          agent_id: AGENT_ORDER_ID,
        }),
        'Agent user request (verified JWT claims)',
      );
    } finally {
      infoSpy.mockRestore();
      await close();
    }
  });

  test('sinchid-agent tool calls reject credentials for a different project than the verified JWT', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    secretManagerAccess.mockResolvedValue([
      { payload: { data: Buffer.from(Buffer.from('project-2:key-1:secret-1').toString('base64')) } },
    ]);
    const { baseUrl, close } = await listen(createHttpApp());
    const token = jwksServer.sign({
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'user-1',
      [SINCH_PROJECT_ID_CLAIM]: 'project-1',
      [SINCH_ACCOUNT_ID_CLAIM]: 'account-1',
      [SINCH_GLOBAL_USER_ID_CLAIM]: 'user-1',
      scope: 'openid',
    });
    const clientTransport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}`, 'x-agent-id': 'order-42' } },
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    try {
      await client.connect(clientTransport);
      const result = await client.callTool({ name: 'list-conversation-apps', arguments: {} });

      expect(result).toMatchObject({
        content: [{ type: 'text', text: MISSING_AGENT_CREDENTIALS_MESSAGE }],
      });
    } finally {
      await client.close();
      await close();
    }
  });

  describe('sinchid-agent token verification', () => {
    beforeEach(() => {
      mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    });

    const postWithToken = (baseUrl: string, token: string) =>
      post(baseUrl, initializeBody, { Authorization: `Bearer ${token}`, 'x-agent-id': 'order-42' });

    test('rejects a forged token that is merely JWT-shaped, and never creates a session', async () => {
      const { baseUrl, close } = await listen(createHttpApp());

      try {
        const forged = `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'unknown-key' })).toString('base64url')}.${Buffer.from(
          JSON.stringify({ iss: ISSUER, aud: AUDIENCE, sub: 'attacker' }),
        ).toString('base64url')}.forged-signature`;

        const response = await postWithToken(baseUrl, forged);

        expect(response.status).toBe(401);
        expect(response.headers.get('mcp-session-id')).toBeNull();
      } finally {
        await close();
      }
    });

    test('rejects an expired token', async () => {
      const { baseUrl, close } = await listen(createHttpApp());

      try {
        const token = jwksServer.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, { expiresIn: '-10s' });
        const response = await postWithToken(baseUrl, token);

        expect(response.status).toBe(401);
        expect(response.headers.get('mcp-session-id')).toBeNull();
      } finally {
        await close();
      }
    });

    test('rejects a token with the wrong audience', async () => {
      const { baseUrl, close } = await listen(createHttpApp());

      try {
        const token = jwksServer.sign({ iss: ISSUER, aud: 'https://someone-else.example', sub: 'user-1' });
        const response = await postWithToken(baseUrl, token);

        expect(response.status).toBe(401);
        expect(response.headers.get('mcp-session-id')).toBeNull();
      } finally {
        await close();
      }
    });

    test('rejects a token with the wrong issuer', async () => {
      const { baseUrl, close } = await listen(createHttpApp());

      try {
        const token = jwksServer.sign({ iss: 'https://evil.example/', aud: AUDIENCE, sub: 'user-1' });
        const response = await postWithToken(baseUrl, token);

        expect(response.status).toBe(401);
        expect(response.headers.get('mcp-session-id')).toBeNull();
      } finally {
        await close();
      }
    });

    test('rejects a token signed with a key that does not match the published JWKS key', async () => {
      const { baseUrl, close } = await listen(createHttpApp());

      try {
        const forgedKey = generateUnpublishedKeyPair();
        const token = jwksServer.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, { privateKey: forgedKey });
        const response = await postWithToken(baseUrl, token);

        expect(response.status).toBe(401);
        expect(response.headers.get('mcp-session-id')).toBeNull();
      } finally {
        await close();
      }
    });
  });

  // Single-tenant registers no auth middleware, so /mcp must serve a request with no
  // Authorization at all — and must not reject one carrying another account's blob either,
  // since nothing reads the header. This is the mode's defining property, not an oversight:
  // it is why single-tenant must never be exposed.
  test('single-tenant serves a request with no Authorization at all', async () => {
    mockEnv.PROJECT_ID = 'project-1';
    mockEnv.KEY_ID = 'key-1';
    mockEnv.KEY_SECRET = 'secret-1';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: ACCEPT_HEADER },
        body: JSON.stringify(initializeBody),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBeTruthy();
    } finally {
      await close();
    }
  });

  test("single-tenant ignores another account's credentials rather than rejecting them", async () => {
    mockEnv.PROJECT_ID = 'project-1';
    mockEnv.KEY_ID = 'key-1';
    mockEnv.KEY_SECRET = 'secret-1';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const otherAccount = Buffer.from('project-2:key-2:secret-2').toString('base64');
      const response = await post(baseUrl, initializeBody, { Authorization: `Bearer ${otherAccount}` });

      expect(response.status).toBe(200);
      expect(getHttpCredentialSource()).toBe('env');
    } finally {
      await close();
    }
  });

  test('single-tenant ignores a JWT in Authorization and does not audit its unverified claims', async () => {
    mockEnv.PROJECT_ID = 'project-1';
    mockEnv.KEY_ID = 'key-1';
    mockEnv.KEY_SECRET = 'secret-1';
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const encodeSegment = (payload: Record<string, unknown>) =>
        Buffer.from(JSON.stringify(payload)).toString('base64url');
      // Shape-valid but unsigned/forged: single-tenant does not read Authorization at all.
      const unverifiedJwt = `${encodeSegment({ alg: 'RS256' })}.${encodeSegment({
        sub: 'user-1',
        [SINCH_PROJECT_ID_CLAIM]: 'project-1',
      })}.forged-signature`;

      const response = await post(baseUrl, initializeBody, { Authorization: `Bearer ${unverifiedJwt}` });

      expect(response.status).toBe(200);
      expect(infoSpy).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Agent user request'));
    } finally {
      infoSpy.mockRestore();
      await close();
    }
  });

  test('health probes stay reachable regardless of auth shape', async () => {
    mockEnv.MCP_AUTH_MODE = 'sinchid-agent';
    const { baseUrl, close } = await listen(createHttpApp());

    try {
      const response = await fetch(`${baseUrl}/health/live`, {
        headers: { Authorization: `Bearer ${credentialsBlob}` },
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
