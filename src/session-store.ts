import Redis from 'ioredis';
import { env } from './env';
import { logger, safeErrorFields } from './telemetry/logger';
import { getServiceMetrics, setActiveSessions, setRedisAvailable } from './telemetry/metrics';

const DEFAULT_SESSION_TTL_SECONDS = 1800;
const REDIS_RETRY_ATTEMPTS = 3;
const REDIS_RETRY_BASE_DELAY_MS = 50;
const REDIS_COMMAND_TIMEOUT_MS = 250;

const sessionKey = (sessionId: string): string => `mcp:session:${sessionId}`;

type StoredSession = {
  sessionId: string;
  ownerId: string;
  createdAt: number;
};

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

let client: Redis | undefined;

const REDIS_CLIENT_OPTIONS = {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  retryStrategy: (times: number) => Math.min(times * 100, 2000),
};

// REDIS_HOST/REDIS_PORT are required to reach this point — src/http.ts's main() fails fast
// on startup otherwise. TLS turns on automatically with a password (AWS ElastiCache requires it).
const getClient = (): Redis => {
  if (!client) {
    client = new Redis({
      host: env.REDIS_HOST,
      port: Number(env.REDIS_PORT),
      password: env.REDIS_PASSWORD,
      tls: env.REDIS_PASSWORD ? {} : undefined,
      ...REDIS_CLIENT_OPTIONS,
    });
    client.on('error', (error) => logger.error(safeErrorFields(error), 'Redis client error'));
  }
  return client;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(operationName: string, operation: () => Promise<T>): Promise<T> => {
  const metrics = getServiceMetrics();
  const startedAt = performance.now();
  let lastError: unknown;
  try {
    for (let attempt = 0; attempt < REDIS_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await operation();
        metrics.redisOperationsTotal.add(1, { operation: operationName, status: 'success' });
        setRedisAvailable(true);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < REDIS_RETRY_ATTEMPTS - 1) {
          await sleep(REDIS_RETRY_BASE_DELAY_MS * 2 ** attempt);
        }
      }
    }
    metrics.redisOperationsTotal.add(1, { operation: operationName, status: 'error' });
    metrics.redisFailuresTotal.add(1, { operation: operationName });
    setRedisAvailable(false);
    throw new SessionStoreUnavailableError(lastError);
  } finally {
    metrics.redisDurationMs.record(performance.now() - startedAt, { operation: operationName });
  }
};

export const createSession = async (sessionId: string, ownerId: string): Promise<void> => {
  await withRetry('set', () =>
    getClient().set(
      sessionKey(sessionId),
      JSON.stringify({ sessionId, ownerId, createdAt: Date.now() } satisfies StoredSession),
      'EX',
      getSessionTtlSeconds(),
    ),
  );
};

export const validateAndTouchSession = async (sessionId: string, ownerId: string): Promise<boolean> => {
  const storedValue = await withRetry('get', () => getClient().get(sessionKey(sessionId)));
  if (!storedValue) {
    return false;
  }

  let storedSession: StoredSession;
  try {
    storedSession = JSON.parse(storedValue) as StoredSession;
  } catch {
    return false;
  }

  if (storedSession.sessionId !== sessionId || storedSession.ownerId !== ownerId) {
    return false;
  }

  const result = await withRetry('expire', () => getClient().expire(sessionKey(sessionId), getSessionTtlSeconds()));
  return result === 1;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await withRetry('del', () => getClient().del(sessionKey(sessionId)));
};

/** Single-attempt reachability check for readiness probes — no retry, fails fast. */
export const pingSessionStore = async (): Promise<boolean> => {
  const startedAt = performance.now();
  try {
    // This deployment uses a dedicated Redis database for sessions, so DBSIZE is
    // an O(1) active-session sample and does not expose session IDs or credentials.
    const [, activeSessionCount] = await Promise.all([getClient().ping(), getClient().dbsize()]);
    setActiveSessions(activeSessionCount);
    getServiceMetrics().redisOperationsTotal.add(1, { operation: 'ping', status: 'success' });
    setRedisAvailable(true);
    return true;
  } catch {
    getServiceMetrics().redisOperationsTotal.add(1, { operation: 'ping', status: 'error' });
    getServiceMetrics().redisFailuresTotal.add(1, { operation: 'ping' });
    setRedisAvailable(false);
    return false;
  } finally {
    getServiceMetrics().redisDurationMs.record(performance.now() - startedAt, { operation: 'ping' });
  }
};

/** Exposed for tests to reset the module-level client between suites. */
export const resetSessionStoreClientForTests = (): void => {
  client?.disconnect();
  client = undefined;
};

/** Exposed for tests to spy on the underlying client (e.g. force a command to fail). */
export const getSessionStoreClientForTests = (): Redis => getClient();
