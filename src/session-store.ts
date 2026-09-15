import { env } from './env';
import { getRedisClient, resetRedisClientForTests } from './redis-client';

const DEFAULT_SESSION_TTL_SECONDS = 1800;
const REDIS_RETRY_ATTEMPTS = 3;
const REDIS_RETRY_BASE_DELAY_MS = 50;

const sessionKey = (sessionId: string): string => `mcp:session:${sessionId}`;

export class SessionStoreUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Session store unavailable', { cause });
    this.name = 'SessionStoreUnavailableError';
  }
}

const getSessionTtlSeconds = (): number => {
  const configured = Number(env.MCP_SESSION_TTL_SECONDS ?? DEFAULT_SESSION_TTL_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_SESSION_TTL_SECONDS;
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
    getRedisClient().set(
      sessionKey(sessionId),
      JSON.stringify({ sessionId, createdAt: Date.now() }),
      'EX',
      getSessionTtlSeconds(),
    ),
  );
};

export const validateAndTouchSession = async (sessionId: string): Promise<boolean> => {
  const result = await withRetry(() => getRedisClient().expire(sessionKey(sessionId), getSessionTtlSeconds()));
  return result === 1;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await withRetry(() => getRedisClient().del(sessionKey(sessionId)));
};

/** Single-attempt reachability check for readiness probes — no retry, fails fast. */
export const pingSessionStore = async (): Promise<boolean> => {
  try {
    await getRedisClient().ping();
    return true;
  } catch {
    return false;
  }
};

/** Exposed for tests to reset the module-level client between suites. */
export const resetSessionStoreClientForTests = (): void => {
  resetRedisClientForTests();
};

/** Exposed for tests to spy on the underlying client (e.g. force a command to fail). */
export const getSessionStoreClientForTests = () => getRedisClient();
