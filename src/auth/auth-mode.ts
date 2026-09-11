import type { NextFunction, Request, Response } from 'express';
import { AGENT_ID_HEADER } from './credential-context';
import { buildBearerWwwAuthenticateHeader } from './mcp-api-key';
import { parseSinchCredentialsAuthorizationHeader } from './sinch-oauth-credentials';
import { isJwtShapedBearerToken } from './user-jwt';
import { extractHeaderValue } from '../utils';

export const MCP_AUTH_MODES = ['client-credentials', 'sinchid-agent'] as const;

export type McpAuthMode = (typeof MCP_AUTH_MODES)[number];

export const isMcpAuthMode = (value: unknown): value is McpAuthMode => {
  return typeof value === 'string' && (MCP_AUTH_MODES as readonly string[]).includes(value);
};

let configuredAuthMode: McpAuthMode | undefined;

export const setAuthMode = (mode: McpAuthMode | undefined): void => {
  configuredAuthMode = mode;
};

/** Undefined in single-tenant HTTP and over stdio, where no auth mode applies. */
export const getAuthMode = (): McpAuthMode | undefined => {
  return configuredAuthMode;
};

export const clearAuthModeForTests = (): void => {
  configuredAuthMode = undefined;
};

/** invalidToken false means no credentials were sent — a realm-only challenge, per RFC 6750. */
type AuthShapeCheck = { ok: true } | { ok: false; reason: string; invalidToken: boolean };

const OK: AuthShapeCheck = { ok: true };

/**
 * Credentials arrive as `Authorization: Bearer <Base64 of projectId:keyId:keySecret>`. A SinchID
 * token is a JWT, so it fails that parse and belongs to the other deployment.
 */
const checkClientCredentials = (req: Request): AuthShapeCheck => {
  if (extractHeaderValue(req.headers[AGENT_ID_HEADER]) !== undefined) {
    return {
      ok: false,
      invalidToken: true,
      reason: `${AGENT_ID_HEADER} is not accepted by a client-credentials deployment; send Sinch API credentials in Authorization instead`,
    };
  }

  if (extractHeaderValue(req.headers.authorization) === undefined) {
    return {
      ok: false,
      invalidToken: false,
      reason: 'Missing Sinch API credentials in the Authorization header',
    };
  }

  if (parseSinchCredentialsAuthorizationHeader(req.headers.authorization) === undefined) {
    return {
      ok: false,
      invalidToken: true,
      reason: 'Authorization must carry Base64 projectId:keyId:keySecret as a Bearer token',
    };
  }

  return OK;
};

/**
 * The SinchID access token in Authorization is the credential, so it is required and must be
 * JWT-shaped. That rejects a Base64 credential triple, which is not a JWT.
 */
const checkSinchidAgent = (req: Request): AuthShapeCheck => {
  if (extractHeaderValue(req.headers.authorization) === undefined) {
    return {
      ok: false,
      invalidToken: false,
      reason: 'Missing SinchID access token in the Authorization header',
    };
  }

  if (!isJwtShapedBearerToken(req.headers.authorization)) {
    return {
      ok: false,
      invalidToken: true,
      reason: 'Authorization must carry a SinchID access token as a Bearer JWT',
    };
  }

  return OK;
};

const AUTH_SHAPE_CHECKS: Record<McpAuthMode, (req: Request) => AuthShapeCheck> = {
  'client-credentials': checkClientCredentials,
  'sinchid-agent': checkSinchidAgent,
};

/**
 * Enforces the one inbound auth shape this deployment was started for. Both endpoints are
 * unauthenticated at the edge (ZAP does TLS and routing only), so accepting anything else
 * here would defeat the point of splitting them.
 */
const rejectWrongShape = (res: Response, reason: string): void => {
  res.setHeader(
    'WWW-Authenticate',
    buildBearerWwwAuthenticateHeader({ error: 'invalid_token', errorDescription: reason }),
  );
  res.status(401).json({ error: 'invalid_token', error_description: reason });
};

/** No credentials at all: RFC 6750 wants a bare challenge, so the guidance goes in the body. */
const rejectMissingCredentials = (res: Response, reason: string): void => {
  res.setHeader('WWW-Authenticate', buildBearerWwwAuthenticateHeader());
  res.status(401).json({ error: 'Unauthorized', error_description: reason });
};

export const createAuthModeMiddleware = (mode: McpAuthMode) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const check = AUTH_SHAPE_CHECKS[mode](req);
    if (check.ok) {
      next();
      return;
    }

    if (check.invalidToken) {
      rejectWrongShape(res, check.reason);
      return;
    }

    rejectMissingCredentials(res, check.reason);
  };
};
