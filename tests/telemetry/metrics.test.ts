import { metrics } from '@opentelemetry/api';
import { getSessionStoreMetrics, resetSessionStoreMetricsForTests } from '../../src/telemetry/metrics';

describe('getSessionStoreMetrics', () => {
  beforeEach(() => {
    resetSessionStoreMetricsForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetSessionStoreMetricsForTests();
  });

  it('creates the degraded counter once and reuses it', () => {
    const createCounter = jest.fn().mockReturnValue({ add: jest.fn() });
    jest.spyOn(metrics, 'getMeter').mockReturnValue({ createCounter } as never);

    const first = getSessionStoreMetrics();
    const second = getSessionStoreMetrics();

    expect(second).toBe(first);
    expect(createCounter).toHaveBeenCalledTimes(1);
    expect(createCounter).toHaveBeenCalledWith('session_store.degraded.total', expect.any(Object));
  });
});
