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
 * True when `token` decodes as a three-segment JWT. Shape only — no signature, issuer, or
 * expiry check. This is used purely to route a request to the right auth mode (and to skip a
 * JWKS lookup on something that plainly isn't a JWT); it grants no trust.
 */
export const isJwtShapedToken = (token: string): boolean => decodeJwtPayloadShape(token) !== undefined;

const stringClaim = (payload: Record<string, unknown>, claim: string): string | undefined => {
  const value = payload[claim];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/**
 * Maps the Sinch user claims out of an already-verified JWT payload (signature, issuer,
 * audience and expiry must have been checked by the caller — see
 * `sinchid-jwt-verifier.ts`). Returns undefined unless the payload contains the complete audit
 * identity required by the SinchID agent contract: project, account, global user, and scope.
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

  const hasRequiredClaims = Boolean(claims.projectId && claims.accountId && claims.globalUserId && claims.scope);
  return hasRequiredClaims ? claims : undefined;
};
