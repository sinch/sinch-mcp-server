import type { NextFunction, Request, Response } from 'express';
import { AGENT_ID_HEADER } from './credential-context';
import { buildBearerWwwAuthenticateHeader, extractBearerToken } from './bearer-token';
import { parseSinchCredentialsAuthorizationHeader } from './sinch-oauth-credentials';
import { verifySinchIdAccessToken } from './sinchid-jwt-verifier';
import { isJwtShapedBearerToken } from './user-jwt';
import { setVerifiedUserClaims } from './verified-claims';
import { extractHeaderValue } from '../utils';

/**
 * The inbound auth shapes a MULTI-TENANT HTTP deployment can be pinned to. Single-tenant is
 * deliberately absent: it is not an auth mode but the absence of one, selected by leaving
 * MCP_AUTH_MODE unset — which then requires PROJECT_ID/KEY_ID/KEY_SECRET (see
 * resolveDeploymentMode). Credential presence never selects the tenancy.
 */
export const MCP_AUTH_MODES = ['client-credentials', 'sinchid-agent'] as const;

export type McpAuthMode = (typeof MCP_AUTH_MODES)[number];

export const isMcpAuthMode = (value: unknown): value is McpAuthMode => {
  return typeof value === 'string' && (MCP_AUTH_MODES as readonly string[]).includes(value);
};

let configuredAuthMode: McpAuthMode | undefined;

export const setAuthMode = (mode: McpAuthMode | undefined): void => {
  configuredAuthMode = mode;
};

/** Undefined in single-tenant HTTP and over stdio, where no inbound auth shape is enforced. */
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
 *
 * `x-agent-id` is a no-op here: this deployment never reads it, and callers are free to send
 * headers we ignore.
 */
const checkClientCredentials = (req: Request): AuthShapeCheck => {
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
 * JWT-shaped. That rejects a Base64 credential triple, which is not a JWT. `x-agent-id` is
 * required alongside it: credentials are resolved from the agent installation it names, so a
 * request without it cannot complete anyway.
 *
 * Being JWT-shaped is not enough to trust it: the token is then verified against the configured
 * JWKS (signature, pinned algorithm, issuer, audience, expiry). Only a token that survives that
 * check gets its claims stashed for the request (see `verified-claims.ts`) — anything else,
 * including a well-formed but forged, expired, or wrong-audience/issuer token, is a 401.
 */
const checkSinchidAgent = async (req: Request): Promise<AuthShapeCheck> => {
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

  if (extractHeaderValue(req.headers[AGENT_ID_HEADER]) === undefined) {
    return {
      ok: false,
      invalidToken: true,
      reason: `${AGENT_ID_HEADER} is required alongside the SinchID access token`,
    };
  }

  const token = extractBearerToken(req.headers.authorization);
  try {
    const claims = await verifySinchIdAccessToken(token!);
    if (claims) {
      setVerifiedUserClaims(req, claims);
    }
    return OK;
  } catch {
    return {
      ok: false,
      invalidToken: true,
      reason: 'SinchID access token failed verification (invalid signature, issuer, audience, or expiry)',
    };
  }
};

const AUTH_SHAPE_CHECKS: Record<McpAuthMode, (req: Request) => AuthShapeCheck | Promise<AuthShapeCheck>> = {
  'client-credentials': checkClientCredentials,
  'sinchid-agent': checkSinchidAgent,
};

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
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const check = await AUTH_SHAPE_CHECKS[mode](req);
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
