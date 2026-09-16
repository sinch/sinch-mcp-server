import { extractBearerToken } from './bearer-token';

/**
 * Sinch-namespaced claims carried by the Auth0 user JWT that agent
 * integrations (e.g. an agent installed in a Gemini Enterprise app) send in
 * the Authorization header after the end-user OAuth flow.
 */
export const SINCH_PROJECT_ID_CLAIM = 'https://sinch.com/project_id';
export const SINCH_ACCOUNT_ID_CLAIM = 'https://sinch.com/account_id';
export const SINCH_EMAIL_CLAIM = 'https://sinch.com/email';
export const SINCH_GLOBAL_USER_ID_CLAIM = 'https://sinch.com/global_user_id';

export type SinchUserClaims = {
  projectId?: string;
  accountId?: string;
  email?: string;
  globalUserId?: string;
  subject?: string;
  scope?: string;
};

const decodeJwtPayloadShape = (token: string): Record<string, unknown> | undefined => {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return undefined;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  return payload as Record<string, unknown>;
};

/**
 * True when Authorization carries a `Bearer` token whose payload decodes as a
 * three-segment JWT. Shape only — no signature, issuer, or expiry check. This
 * is used purely to route a request to the right auth mode (and to skip a
 * JWKS lookup on something that plainly isn't a JWT); it grants no trust.
 */
export const isJwtShapedBearerToken = (authorizationHeader: string | string[] | undefined): boolean => {
  const token = extractBearerToken(authorizationHeader);
  return token !== undefined && decodeJwtPayloadShape(token) !== undefined;
};

const stringClaim = (payload: Record<string, unknown>, claim: string): string | undefined => {
  const value = payload[claim];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/**
 * Maps the Sinch user claims out of an already-verified JWT payload (signature, issuer,
 * audience and expiry must have been checked by the caller — see
 * `sinchid-jwt-verifier.ts`). Returns undefined when the payload carries none of the
 * expected claims (nothing useful to audit).
 */
export const mapSinchUserClaims = (payload: Record<string, unknown>): SinchUserClaims | undefined => {
  const claims: SinchUserClaims = {
    projectId: stringClaim(payload, SINCH_PROJECT_ID_CLAIM),
    accountId: stringClaim(payload, SINCH_ACCOUNT_ID_CLAIM),
    email: stringClaim(payload, SINCH_EMAIL_CLAIM),
    globalUserId: stringClaim(payload, SINCH_GLOBAL_USER_ID_CLAIM),
    subject: stringClaim(payload, 'sub'),
    scope: stringClaim(payload, 'scope'),
  };

  const hasAnyClaim = Object.values(claims).some((value) => value !== undefined);
  return hasAnyClaim ? claims : undefined;
};

/**
 * Decodes the Sinch claims from a Bearer JWT in Authorization WITHOUT verifying its signature,
 * issuer, or expiry — the claims are self-reported and used for audit purposes only.
 *
 * Single-tenant only: it is the sole deployment mode with no auth-mode middleware to verify the
 * token first (see `sinchid-jwt-verifier.ts`), and it enforces no Authorization shape at all, so
 * there is no verified alternative there. Multi-tenant modes must use `getVerifiedUserClaims`
 * (from `verified-claims.ts`) instead and must never call this.
 */
export const decodeUnverifiedUserJwtHeaderForSingleTenant = (
  authorizationHeader: string | string[] | undefined,
): SinchUserClaims | undefined => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return undefined;
  }

  const payload = decodeJwtPayloadShape(token);
  return payload ? mapSinchUserClaims(payload) : undefined;
};
