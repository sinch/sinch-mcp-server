import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const BEARER_SCHEME = 'bearer';
const MCP_BEARER_REALM = 'sinch-mcp';

type BearerAuthChallenge = {
  error?: 'invalid_token';
  errorDescription?: string;
};

export const buildBearerWwwAuthenticateHeader = (
  challenge: BearerAuthChallenge = {},
): string => {
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

const hashToken = (token: string): Buffer =>
  createHash('sha256').update(token).digest();

const tokensMatch = (provided: string, expected: string): boolean => {
  // Compare fixed-length SHA-256 digests so timingSafeEqual never needs a
  // length pre-check (which would leak the expected key length via timing).
  return timingSafeEqual(hashToken(provided), hashToken(expected));
};

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
  const headers =
    authorizationHeader === undefined
      ? []
      : Array.isArray(authorizationHeader)
        ? authorizationHeader
        : [authorizationHeader];

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
      if (token === undefined) {
        res.setHeader('WWW-Authenticate', buildBearerWwwAuthenticateHeader());
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.setHeader(
        'WWW-Authenticate',
        buildBearerWwwAuthenticateHeader({
          error: 'invalid_token',
          errorDescription: 'The MCP API key is invalid',
        }),
      );
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'The MCP API key is invalid',
      });
      return;
    }

    next();
  };
};
