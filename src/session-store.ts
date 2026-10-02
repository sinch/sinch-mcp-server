import Redis from 'ioredis';
import { env } from './env';
import { logger, safeErrorFields } from './telemetry/logger';
import { getServiceMetrics, setRedisAvailable } from './telemetry/metrics';

const DEFAULT_SESSION_TTL_SECONDS = 1800;
const REDIS_RETRY_ATTEMPTS = 3;
const REDIS_RETRY_BASE_DELAY_MS = 50;
const REDIS_COMMAND_TIMEOUT_MS = 250;

const sessionKey = (sessionId: string): string => `mcp:session:${sessionId}`;

const VALIDATE_AND_TOUCH_SCRIPT = `
local owner = redis.call('GET', KEYS[1])
if owner == ARGV[1] then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`;

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
  let attempts = 0;
  let operationStatus = 'error';
  try {
    for (let attempt = 0; attempt < REDIS_RETRY_ATTEMPTS; attempt++) {
      attempts = attempt + 1;
      const commandStartedAt = performance.now();
      try {
        const result = await operation();
        metrics.redisCommandDurationMs.record(performance.now() - commandStartedAt, {
          operation: operationName,
          status: 'success',
          attempt: attempts,
        });
        metrics.redisOperationsTotal.add(1, { operation: operationName, status: 'success' });
        setRedisAvailable(true);
        operationStatus = 'success';
        return result;
      } catch (error) {
        metrics.redisCommandDurationMs.record(performance.now() - commandStartedAt, {
          operation: operationName,
          status: 'error',
          attempt: attempts,
        });
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
    metrics.redisDurationMs.record(performance.now() - startedAt, {
      operation: operationName,
      status: operationStatus,
      attempts,
    });
  }
};

export const createSession = async (sessionId: string, ownerId: string): Promise<void> => {
  await withRetry('set', () => getClient().set(sessionKey(sessionId), ownerId, 'EX', getSessionTtlSeconds()));
};

export const validateAndTouchSession = async (sessionId: string, ownerId: string): Promise<boolean> => {
  const result = await withRetry('validate_and_touch', () =>
    getClient().eval(VALIDATE_AND_TOUCH_SCRIPT, 1, sessionKey(sessionId), ownerId, getSessionTtlSeconds()),
  );
  return Number(result) === 1;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await withRetry('del', () => getClient().del(sessionKey(sessionId)));
};

/** Single-attempt reachability check for readiness probes — no retry, fails fast. */
export const pingSessionStore = async (): Promise<boolean> => {
  const startedAt = performance.now();
  let status = 'error';
  try {
    await getClient().ping();
    getServiceMetrics().redisOperationsTotal.add(1, { operation: 'ping', status: 'success' });
    setRedisAvailable(true);
    status = 'success';
    return true;
  } catch {
    getServiceMetrics().redisOperationsTotal.add(1, { operation: 'ping', status: 'error' });
    getServiceMetrics().redisFailuresTotal.add(1, { operation: 'ping' });
    setRedisAvailable(false);
    return false;
  } finally {
    const durationMs = performance.now() - startedAt;
    getServiceMetrics().redisCommandDurationMs.record(durationMs, { operation: 'ping', status, attempt: 1 });
    getServiceMetrics().redisDurationMs.record(durationMs, { operation: 'ping', status, attempts: 1 });
  }
};

/** Exposed for tests to reset the module-level client between suites. */
export const resetSessionStoreClientForTests = (): void => {
  client?.disconnect();
  client = undefined;
};

/** Exposed for tests to spy on the underlying client (e.g. force a command to fail). */
export const getSessionStoreClientForTests = (): Redis => getClient();
