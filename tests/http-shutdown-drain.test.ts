import { getShutdownDrainMs } from '../src/http';

describe('getShutdownDrainMs', () => {
  const originalValue = process.env.SHUTDOWN_DRAIN_MS;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.SHUTDOWN_DRAIN_MS;
    } else {
      process.env.SHUTDOWN_DRAIN_MS = originalValue;
    }
  });

  it('defaults to 10000ms when unset', () => {
    delete process.env.SHUTDOWN_DRAIN_MS;
    expect(getShutdownDrainMs()).toBe(10_000);
  });

  it('uses a configured non-negative value, floored', () => {
    process.env.SHUTDOWN_DRAIN_MS = '2500.9';
    expect(getShutdownDrainMs()).toBe(2500);
  });

  it('falls back to the default for negative or non-finite values', () => {
    process.env.SHUTDOWN_DRAIN_MS = '-5';
    expect(getShutdownDrainMs()).toBe(10_000);

    process.env.SHUTDOWN_DRAIN_MS = 'not-a-number';
    expect(getShutdownDrainMs()).toBe(10_000);
  });
});
