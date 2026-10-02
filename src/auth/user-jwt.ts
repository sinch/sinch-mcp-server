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

export type RequiredSinchUserClaim = 'project_id' | 'account_id' | 'global_user_id' | 'scope';
export type SinchUserClaimIssue = {
  claim: RequiredSinchUserClaim;
  code: 'missing' | 'not_string' | 'blank';
};

export type RequiredSinchUserClaims = SinchUserClaims & {
  projectId: string;
  accountId: string;
  globalUserId: string;
  scope: string;
};

export type SinchUserClaimsParseResult =
  { ok: true; claims: RequiredSinchUserClaims } | { ok: false; issues: SinchUserClaimIssue[] };

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
  if (!Object.hasOwn(payload, claim)) {
    return undefined;
  }
  const value = payload[claim];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const requiredClaimIssue = (
  payload: Record<string, unknown>,
  claim: string,
  publicName: RequiredSinchUserClaim,
): SinchUserClaimIssue | undefined => {
  if (!Object.hasOwn(payload, claim)) {
    return { claim: publicName, code: 'missing' };
  }
  const value = payload[claim];
  if (typeof value !== 'string') {
    return { claim: publicName, code: 'not_string' };
  }
  return value.trim() ? undefined : { claim: publicName, code: 'blank' };
};

/**
 * Parses the Sinch user claims out of an already-verified JWT payload (signature, issuer,
 * audience and expiry must have been checked by the caller — see `sinchid-jwt-verifier.ts`).
 * Invalid, blank, and absent required claims are reported by their public claim names without
 * exposing any token values.
 */
export const parseSinchUserClaims = (payload: Record<string, unknown>): SinchUserClaimsParseResult => {
  const issues = [
    requiredClaimIssue(payload, SINCH_PROJECT_ID_CLAIM, 'project_id'),
    requiredClaimIssue(payload, SINCH_ACCOUNT_ID_CLAIM, 'account_id'),
    requiredClaimIssue(payload, SINCH_GLOBAL_USER_ID_CLAIM, 'global_user_id'),
    requiredClaimIssue(payload, 'scope', 'scope'),
  ].filter((issue): issue is SinchUserClaimIssue => issue !== undefined);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    claims: {
      projectId: payload[SINCH_PROJECT_ID_CLAIM] as string,
      accountId: payload[SINCH_ACCOUNT_ID_CLAIM] as string,
      email: stringClaim(payload, SINCH_EMAIL_CLAIM),
      globalUserId: payload[SINCH_GLOBAL_USER_ID_CLAIM] as string,
      subject: stringClaim(payload, 'sub'),
      scope: payload.scope as string,
    },
  };
};
