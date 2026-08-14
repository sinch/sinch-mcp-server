/**
 * Custom header carrying the agent installation identifier (e.g. the Gemini
 * Enterprise Marketplace OrderId). Temporary mechanism until a token-exchange
 * capability is available over M2M authentication; the MCP server will use it
 * to resolve the Sinch credentials for the calling installation.
 */
export const AGENT_ID_HEADER = 'x-agent-id';

export const parseAgentIdHeader = (headerValue: string | string[] | undefined): string | undefined => {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
