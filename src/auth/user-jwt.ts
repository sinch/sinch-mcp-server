import { extractBearerToken } from './mcp-api-key';

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
};

const decodeJwtPayload = (token: string): Record<string, unknown> | undefined => {
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

const stringClaim = (payload: Record<string, unknown>, claim: string): string | undefined => {
  const value = payload[claim];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/**
 * Extracts the Sinch user claims from a `Bearer <JWT>` Authorization header.
 *
 * The payload is base64url-decoded WITHOUT verifying the token signature,
 * issuer, or expiry: the claims are self-reported and used for audit purposes
 * only (credentials are resolved through other mechanisms). Verification will
 * come with the future user-JWT to M2M-JWT token exchange.
 *
 * Returns undefined for anything that is not a well-formed three-segment JWT
 * with a JSON object payload (e.g. an opaque MCP API key in single-tenant
 * mode, or a missing header).
 */
export const decodeUserJwtHeader = (
  authorizationHeader: string | string[] | undefined,
): SinchUserClaims | undefined => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return undefined;
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return undefined;
  }

  return {
    projectId: stringClaim(payload, SINCH_PROJECT_ID_CLAIM),
    accountId: stringClaim(payload, SINCH_ACCOUNT_ID_CLAIM),
    email: stringClaim(payload, SINCH_EMAIL_CLAIM) ?? stringClaim(payload, 'email'),
    globalUserId: stringClaim(payload, SINCH_GLOBAL_USER_ID_CLAIM),
    subject: stringClaim(payload, 'sub'),
  };
};
