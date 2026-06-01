import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const BEARER_PREFIX = 'Bearer ';

export const loadMcpApiKeys = (): string[] => {
  const keys: string[] = [];

  const singleKey = process.env.MCP_API_KEY?.trim();
  if (singleKey) {
    keys.push(singleKey);
  }

  const multipleKeys = process.env.MCP_API_KEYS?.split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (multipleKeys?.length) {
    keys.push(...multipleKeys);
  }

  return [...new Set(keys)];
};

export const extractBearerToken = (
  authorizationHeader: string | string[] | undefined,
): string | undefined => {
  const header = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  if (!header?.startsWith(BEARER_PREFIX)) {
    return undefined;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
};

const tokensMatch = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

export const isValidMcpApiKey = (
  providedToken: string | undefined,
  configuredKeys: string[],
): boolean => {
  if (!providedToken || configuredKeys.length === 0) {
    return false;
  }

  return configuredKeys.some((key) => tokensMatch(providedToken, key));
};

export const createMcpApiKeyMiddleware = (configuredKeys: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (configuredKeys.length === 0) {
      res.status(503).json({
        error: 'MCP API key is not configured. Set MCP_API_KEY or MCP_API_KEYS.',
      });
      return;
    }

    const token = extractBearerToken(req.headers.authorization);
    if (!isValidMcpApiKey(token, configuredKeys)) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="sinch-mcp"');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
};
