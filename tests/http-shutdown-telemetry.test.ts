import type { Server } from 'node:http';
import { shutdown } from '../src/http';
import { shutdownTelemetry } from '../src/telemetry';

jest.mock('../src/telemetry', () => ({
  initTelemetry: jest.fn(),
  shutdownTelemetry: jest.fn(),
}));

const mockShutdownTelemetry = shutdownTelemetry as jest.MockedFunction<typeof shutdownTelemetry>;

describe('shutdown', () => {
  const originalDrain = process.env.SHUTDOWN_DRAIN_MS;
  const calls: string[] = [];
  let exitSpy: jest.SpyInstance;

  beforeAll(() => {
    process.env.SHUTDOWN_DRAIN_MS = '0';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      calls.push(`exit:${code}`);
    }) as never);
    mockShutdownTelemetry.mockImplementation(async () => {
      calls.push('flush-telemetry');
    });
  });

  afterAll(() => {
    if (originalDrain === undefined) {
      delete process.env.SHUTDOWN_DRAIN_MS;
    } else {
      process.env.SHUTDOWN_DRAIN_MS = originalDrain;
    }
    jest.restoreAllMocks();
  });

  // One test: `shutdown` latches module-level state, so it can only run once per module load.
  it('flushes telemetry after closing the server and before exiting, once', async () => {
    const server = {
      close: jest.fn((callback: (error?: Error) => void) => {
        calls.push('close-server');
        callback();
      }),
    } as unknown as Server;

    await shutdown(server, 'SIGTERM');
    // A second signal during shutdown must not close or flush again.
    await shutdown(server, 'SIGINT');

    expect(calls).toEqual(['close-server', 'flush-telemetry', 'exit:0']);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });
});
