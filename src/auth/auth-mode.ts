import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SigningKeyNotFoundError } from 'jwks-rsa';
import { AGENT_ID_HEADER } from './credential-context';
import { buildBearerWwwAuthenticateHeader, extractBearerToken } from './bearer-token';
import { parseSinchCredentialsAuthorizationHeader } from './sinch-oauth-credentials';
import { verifySinchIdAccessToken } from './sinchid-jwt-verifier';
import { isJwtShapedToken, mapSinchUserClaims } from './user-jwt';
import { setVerifiedUserClaims } from './verified-claims';
import { logger } from '../telemetry/logger';
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

/** missing: realm-only 401 (RFC 6750). invalid: 401 naming why. unavailable: 503, just retry. */
type AuthShapeFailureKind = 'missing' | 'invalid' | 'unavailable';
type AuthShapeCheck = { ok: true } | { ok: false; reason: string; kind: AuthShapeFailureKind };

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
      kind: 'missing',
      reason: 'Missing Sinch API credentials in the Authorization header',
    };
  }

  if (parseSinchCredentialsAuthorizationHeader(req.headers.authorization) === undefined) {
    return {
      ok: false,
      kind: 'invalid',
      reason: 'Authorization must carry Base64 projectId:keyId:keySecret as a Bearer token',
    };
  }

  return OK;
};

/**
 * The SinchID token is the credential: required, JWT-shaped, and paired with `x-agent-id`. It's
 * then verified against the JWKS and mapped to Sinch claims — a forged, expired, wrong-audience/
 * issuer, or claims-less token is a 401. If verification couldn't run at all (JWKS unreachable
 * or rate-limited), that's a 503, not a 401.
 */
const checkSinchidAgent = async (req: Request): Promise<AuthShapeCheck> => {
  const token = extractBearerToken(req.headers.authorization);
  if (token === undefined) {
    return {
      ok: false,
      kind: 'missing',
      reason: 'Missing SinchID access token in the Authorization header',
    };
  }

  if (!isJwtShapedToken(token)) {
    return {
      ok: false,
      kind: 'invalid',
      reason: 'Authorization must carry a SinchID access token as a Bearer JWT',
    };
  }

  if (extractHeaderValue(req.headers[AGENT_ID_HEADER]) === undefined) {
    return {
      ok: false,
      kind: 'invalid',
      reason: `${AGENT_ID_HEADER} is required alongside the SinchID access token`,
    };
  }

  let payload: jwt.JwtPayload;
  try {
    payload = await verifySinchIdAccessToken(token);
  } catch (error) {
    // A jsonwebtoken error or unresolvable kid means the token itself is bad; anything else
    // (JWKS unreachable, rate-limited) means we just couldn't check it.
    if (error instanceof jwt.JsonWebTokenError || error instanceof SigningKeyNotFoundError) {
      return {
        ok: false,
        kind: 'invalid',
        reason: 'SinchID access token failed verification (invalid signature, issuer, audience, or expiry)',
      };
    }
    logger.warn({ err: error }, 'Could not verify the SinchID access token: the signing-key service is unavailable');
    return {
      ok: false,
      kind: 'unavailable',
      reason: 'Could not verify the SinchID access token: the signing-key service is temporarily unavailable',
    };
  }

  const claims = mapSinchUserClaims(payload);
  if (!claims) {
    return {
      ok: false,
      kind: 'invalid',
      reason: 'SinchID access token is missing the expected Sinch claims',
    };
  }

  setVerifiedUserClaims(req, claims);
  return OK;
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

/** Verification itself couldn't run — a transient problem on our side, not the caller's. */
const rejectUnavailable = (res: Response, reason: string): void => {
  res.setHeader('Retry-After', '2');
  res.status(503).json({ error: 'temporarily_unavailable', error_description: reason });
};

const AUTH_SHAPE_REJECTIONS: Record<AuthShapeFailureKind, (res: Response, reason: string) => void> = {
  invalid: rejectWrongShape,
  unavailable: rejectUnavailable,
  missing: rejectMissingCredentials,
};

export const createAuthModeMiddleware = (mode: McpAuthMode) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const check = await AUTH_SHAPE_CHECKS[mode](req);
    if (check.ok) {
      next();
      return;
    }

    AUTH_SHAPE_REJECTIONS[check.kind](res, check.reason);
  };
};
