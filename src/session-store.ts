import Redis from 'ioredis';

const DEFAULT_SESSION_TTL_SECONDS = 1800;
const REDIS_RETRY_ATTEMPTS = 3;
const REDIS_RETRY_BASE_DELAY_MS = 50;
const REDIS_COMMAND_TIMEOUT_MS = 250;

const sessionKey = (sessionId: string): string => `mcp:session:${sessionId}`;

export class SessionStoreUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Session store unavailable', { cause });
    this.name = 'SessionStoreUnavailableError';
  }
}

const getSessionTtlSeconds = (): number => {
  const configured = Number(process.env.MCP_SESSION_TTL_SECONDS ?? DEFAULT_SESSION_TTL_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_SESSION_TTL_SECONDS;
};

let client: Redis | undefined;

const getClient = (): Redis => {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });
    client.on('error', (error) => console.error('Redis client error:', error));
  }
  return client;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < REDIS_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < REDIS_RETRY_ATTEMPTS - 1) {
        await sleep(REDIS_RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
  throw new SessionStoreUnavailableError(lastError);
};

export const createSession = async (sessionId: string): Promise<void> => {
  await withRetry(() =>
    getClient().set(
      sessionKey(sessionId),
      JSON.stringify({ sessionId, createdAt: Date.now() }),
      'EX',
      getSessionTtlSeconds(),
    ),
  );
};

export const validateAndTouchSession = async (sessionId: string): Promise<boolean> => {
  const result = await withRetry(() => getClient().expire(sessionKey(sessionId), getSessionTtlSeconds()));
  return result === 1;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await withRetry(() => getClient().del(sessionKey(sessionId)));
};

/** Single-attempt reachability check for readiness probes — no retry, fails fast. */
export const pingSessionStore = async (): Promise<boolean> => {
  try {
    await getClient().ping();
    return true;
  } catch {
    return false;
  }
};

/** Exposed for tests to reset the module-level client between suites. */
export const resetSessionStoreClientForTests = (): void => {
  client?.disconnect();
  client = undefined;
};

/** Exposed for tests to spy on the underlying client (e.g. force a command to fail). */
export const getSessionStoreClientForTests = (): Redis => getClient();
