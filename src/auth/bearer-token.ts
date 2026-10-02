const BEARER_SCHEME = 'bearer';
const MCP_BEARER_REALM = 'sinch-mcp';

type BearerAuthChallenge = {
  error?: 'invalid_token';
  errorDescription?: string;
};

export const buildBearerWwwAuthenticateHeader = (challenge: BearerAuthChallenge = {}): string => {
  const parts = [`Bearer realm="${MCP_BEARER_REALM}"`];

  if (challenge.error) {
    parts.push(`error="${challenge.error}"`);
  }

  if (challenge.errorDescription) {
    parts.push(`error_description="${challenge.errorDescription}"`);
  }

  return parts.join(', ');
};

const extractTokenFromAuthorizationValue = (header: string): string | undefined => {
  const trimmed = header.trim();
  const schemeEnd = trimmed.indexOf(' ');
  if (schemeEnd === -1) {
    return undefined;
  }

  if (trimmed.slice(0, schemeEnd).toLowerCase() !== BEARER_SCHEME) {
    return undefined;
  }

  const token = trimmed.slice(schemeEnd + 1).trim();
  return token.length > 0 ? token : undefined;
};

export const extractBearerToken = (authorizationHeader: string | string[] | undefined): string | undefined => {
  let headers: string[];
  if (authorizationHeader === undefined) {
    headers = [];
  } else if (Array.isArray(authorizationHeader)) {
    headers = authorizationHeader;
  } else {
    headers = [authorizationHeader];
  }

  for (const header of headers) {
    if (!header) {
      continue;
    }

    const token = extractTokenFromAuthorizationValue(header);
    if (token !== undefined) {
      return token;
    }
  }

  return undefined;
};
