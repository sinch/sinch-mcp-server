export const TEMPERATURE = 0; //no variability for testing
export const MAX_TOKENS = 1024;
// Per-case timeout. mcp-jam's HostRunner does an agentic step + tool execution
// on top of the LLM call, so allow more headroom than a raw single API call —
// otherwise cases flake on slow/rate-limited moments.
export const TIMEOUT = 30000;
