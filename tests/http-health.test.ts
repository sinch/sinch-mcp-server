import http from 'http';
import type { AddressInfo } from 'net';
import { clearAuthModeForTests } from '../src/auth/auth-mode';
import { clearHttpCredentialSourceForTests } from '../src/auth/http-credential-mode';
import { mockEnv, resetMockEnv } from '../src/__mocks__/env';
import { createHttpApp, setShuttingDownForTests } from '../src/http';
import { pingSessionStore } from '../src/session-store';

jest.mock('../src/session-store', () => ({
  ...jest.requireActual('../src/session-store'),
  pingSessionStore: jest.fn(),
}));

const mockedPingSessionStore = pingSessionStore as jest.MockedFunction<typeof pingSessionStore>;

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

describe('HTTP health endpoints', () => {
  beforeEach(() => {
    mockEnv.CONVERSATION_REGION = 'eu';
    mockEnv.MCP_AUTH_MODE = 'client-credentials';
    setShuttingDownForTests(false);
    mockedPingSessionStore.mockResolvedValue(true);
  });

  afterEach(() => {
    setShuttingDownForTests(false);
    mockedPingSessionStore.mockReset();
    resetMockEnv();
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
  });

  it('returns 200 on /health/live without authentication', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/health/live`);
      const body = (await response.json()) as { status: string; uptimeSeconds: number };

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(typeof body.uptimeSeconds).toBe('number');
    } finally {
      await close();
    }
  });

  it('returns 200 on /health/ready when accepting traffic and the session store is reachable', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      const body = (await response.json()) as { status: string };

      expect(response.status).toBe(200);
      expect(body.status).toBe('ready');
    } finally {
      await close();
    }
  });

  it('returns 503 on /health/ready while shutting down', async () => {
    setShuttingDownForTests(true);
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      const body = (await response.json()) as { status: string; reason: string };

      expect(response.status).toBe(503);
      expect(body).toEqual({ status: 'not_ready', reason: 'shutting_down' });
    } finally {
      await close();
    }
  });

  it('returns 503 on /health/ready when the session store is unreachable', async () => {
    mockedPingSessionStore.mockResolvedValue(false);
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      const body = (await response.json()) as { status: string; reason: string };

      expect(response.status).toBe(503);
      expect(body).toEqual({ status: 'not_ready', reason: 'session_store_unreachable' });
    } finally {
      await close();
    }
  });
});
