import http from 'http';
import type { AddressInfo } from 'net';
import { clearMaxMcpSessionsForTests, setMaxMcpSessionsForTests } from '../src/auth/http-session-limits';
import { clearSessionsForTests, createHttpApp, seedSessionForTests, setShuttingDownForTests } from '../src/http';

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
  const originalApiKey = process.env.MCP_API_KEY;

  beforeEach(() => {
    process.env.MCP_API_KEY = 'test-health-key';
    setShuttingDownForTests(false);
    clearMaxMcpSessionsForTests();
    clearSessionsForTests();
  });

  afterEach(() => {
    setShuttingDownForTests(false);
    clearMaxMcpSessionsForTests();
    clearSessionsForTests();
    if (originalApiKey === undefined) {
      delete process.env.MCP_API_KEY;
    } else {
      process.env.MCP_API_KEY = originalApiKey;
    }
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

  it('returns 200 on /health/ready when accepting traffic', async () => {
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      const body = (await response.json()) as {
        status: string;
        activeSessions: number;
        maxSessions: number;
      };

      expect(response.status).toBe(200);
      expect(body.status).toBe('ready');
      expect(body.activeSessions).toBe(0);
      expect(typeof body.maxSessions).toBe('number');
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

  it('returns 503 on /health/ready when session capacity is reached', async () => {
    setMaxMcpSessionsForTests(1);
    seedSessionForTests();
    const { baseUrl, close } = await listen(createHttpApp());
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      const body = (await response.json()) as { status: string; reason: string };

      expect(response.status).toBe(503);
      expect(body.status).toBe('not_ready');
      expect(body.reason).toBe('session_capacity_reached');
    } finally {
      await close();
    }
  });
});
