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

describe('session-store', () => {
  beforeEach(() => {
    mockEnv.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetSessionStoreClientForTests();
    mockEnv.REDIS_URL = undefined;
  });

  it('validates a session created moments earlier', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId);

    await expect(validateAndTouchSession(sessionId)).resolves.toBeTrue();
  });

  it('reports an unknown session id as invalid', async () => {
    await expect(validateAndTouchSession(randomUUID())).resolves.toBeFalse();
  });

  it('invalidates a session once deleted', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId);
    await deleteSession(sessionId);

    await expect(validateAndTouchSession(sessionId)).resolves.toBeFalse();
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
    jest.spyOn(client, 'expire').mockRejectedValue(new Error('connection refused'));

    await expect(validateAndTouchSession(randomUUID())).rejects.toThrow(SessionStoreUnavailableError);
  });

  it('succeeds once a transient failure clears within the retry budget', async () => {
    const sessionId = randomUUID();
    await createSession(sessionId);

    const client = getSessionStoreClientForTests();
    const realExpire = client.expire.bind(client);
    jest
      .spyOn(client, 'expire')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockImplementationOnce(realExpire);

    await expect(validateAndTouchSession(sessionId)).resolves.toBeTrue();
  });
});
