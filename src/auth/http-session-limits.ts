export const DEFAULT_MAX_MCP_SESSIONS = 256;

export const getMaxMcpSessions = (): number => {
  const configured = Number(process.env.MCP_MAX_SESSIONS ?? DEFAULT_MAX_MCP_SESSIONS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_MCP_SESSIONS;
};

export const isMcpSessionCapacityReached = (activeSessions: number): boolean => {
  return activeSessions >= getMaxMcpSessions();
};

export const setMaxMcpSessionsForTests = (max: number): void => {
  process.env.MCP_MAX_SESSIONS = String(max);
};

export const clearMaxMcpSessionsForTests = (): void => {
  delete process.env.MCP_MAX_SESSIONS;
};
