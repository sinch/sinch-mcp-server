import { randomUUID } from 'node:crypto';

jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

import { mockEnv } from '../src/__mocks__/env';
import {
  createSession,
  deleteSession,
  getSessionStoreClientForTests,
  pingSessionStore,
  resetSessionStoreClientForTests,
  SessionStoreUnavailableError,
  validateAndTouchSession,
} from '../src/session-store';
import { getServiceMetrics } from '../src/telemetry/metrics';

describe('session-store', () => {
  const ownerId = 'owner-1';

  beforeEach(() => {
    mockEnv.REDIS_HOST = '127.0.0.1';
    mockEnv.REDIS_PORT = '6379';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetSessionStoreClientForTests();
    mockEnv.REDIS_HOST = undefined;
    mockEnv.REDIS_PORT = undefined;
  });

  it('validates a session created moments earlier', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId, ownerId);

    await expect(validateAndTouchSession(sessionId, ownerId)).resolves.toBeTrue();
  });

  it('reports an unknown session id as invalid', async () => {
    await expect(validateAndTouchSession(randomUUID(), ownerId)).resolves.toBeFalse();
  });

  it('rejects a session presented by a different owner', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId, ownerId);

    await expect(validateAndTouchSession(sessionId, 'owner-2')).resolves.toBeFalse();
  });

  it('invalidates a session once deleted', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId, ownerId);
    await deleteSession(sessionId);

    await expect(validateAndTouchSession(sessionId, ownerId)).resolves.toBeFalse();
  });

  it('reports the store reachable when Redis responds to PING', async () => {
    await expect(pingSessionStore()).resolves.toBeTrue();
  });

  it('reports the store unreachable when PING fails, without throwing', async () => {
    const client = getSessionStoreClientForTests();
    jest.spyOn(client, 'ping').mockRejectedValue(new Error('connection refused'));

    await expect(pingSessionStore()).resolves.toBeFalse();
  });

  it('throws SessionStoreUnavailableError after exhausting retries on persistent failure', async () => {
    const client = getSessionStoreClientForTests();
    jest.spyOn(client, 'eval').mockRejectedValue(new Error('connection refused'));

    await expect(validateAndTouchSession(randomUUID(), ownerId)).rejects.toThrow(SessionStoreUnavailableError);
  });

  it('succeeds once a transient failure clears within the retry budget', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId, ownerId);

    const commandDurationSpy = jest.spyOn(getServiceMetrics().redisCommandDurationMs, 'record');
    const operationDurationSpy = jest.spyOn(getServiceMetrics().redisDurationMs, 'record');
    const client = getSessionStoreClientForTests();
    const realEval = client.eval.bind(client);
    jest
      .spyOn(client, 'eval')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockImplementationOnce(realEval);

    await expect(validateAndTouchSession(sessionId, ownerId)).resolves.toBeTrue();
    expect(
      commandDurationSpy.mock.calls.filter(
        ([, attributes]) => attributes?.operation === 'validate_and_touch' && attributes.attempt !== undefined,
      ),
    ).toHaveLength(3);
    expect(operationDurationSpy).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ operation: 'validate_and_touch', status: 'success', attempts: 3 }),
    );
  });

  it('enables TLS automatically when REDIS_PASSWORD is set (AWS ElastiCache requires it)', () => {
    mockEnv.REDIS_PASSWORD = 'test-password';
    const client = getSessionStoreClientForTests();
    expect(client.options.tls).toBeTruthy();
    mockEnv.REDIS_PASSWORD = undefined;
  });

  it('does not enable TLS when no password is configured', () => {
    const client = getSessionStoreClientForTests();
    expect(client.options.tls).toBeFalsy();
  });
});
