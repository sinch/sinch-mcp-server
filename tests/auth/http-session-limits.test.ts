import {
  clearMaxMcpSessionsForTests,
  DEFAULT_MAX_MCP_SESSIONS,
  getMaxMcpSessions,
  isMcpSessionCapacityReached,
  setMaxMcpSessionsForTests,
} from '../../src/auth/http-session-limits';

describe('http-session-limits', () => {
  const originalEnv = process.env.MCP_MAX_SESSIONS;

  afterEach(() => {
    if (originalEnv === undefined) {
      clearMaxMcpSessionsForTests();
    } else {
      process.env.MCP_MAX_SESSIONS = originalEnv;
    }
  });

  it('defaults to 256 sessions', () => {
    clearMaxMcpSessionsForTests();
    expect(getMaxMcpSessions()).toBe(DEFAULT_MAX_MCP_SESSIONS);
  });

  it('reads MCP_MAX_SESSIONS from the environment', () => {
    setMaxMcpSessionsForTests(32);
    expect(getMaxMcpSessions()).toBe(32);
  });

  it('reports capacity when active sessions reach the limit', () => {
    setMaxMcpSessionsForTests(2);
    expect(isMcpSessionCapacityReached(1)).toBe(false);
    expect(isMcpSessionCapacityReached(2)).toBe(true);
  });
});
