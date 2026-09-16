import type { Request } from 'express';
import type { SinchUserClaims } from './user-jwt';

/**
 * Carries claims from a JWT that has already passed signature/issuer/audience/expiry
 * verification (see `sinchid-jwt-verifier.ts`) from the auth-mode middleware, which has the
 * Express `Request`, to the per-request `AsyncLocalStorage` context built in `http.ts`. Keyed by
 * request object so nothing here can be read for a request whose token was never verified.
 */
const verifiedClaimsByRequest = new WeakMap<Request, SinchUserClaims>();

export const setVerifiedUserClaims = (req: Request, claims: SinchUserClaims): void => {
  verifiedClaimsByRequest.set(req, claims);
};

export const getVerifiedUserClaims = (req: Request): SinchUserClaims | undefined => {
  return verifiedClaimsByRequest.get(req);
};
