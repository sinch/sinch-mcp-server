import jwt, { type Algorithm } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { env } from '../env';
import { mapSinchUserClaims, type SinchUserClaims } from './user-jwt';

// Pinned, not env-configurable: the token's own `alg` header must never decide which algorithm
// (or key type) verification uses — that is exactly the "alg confusion" class of attack.
const ALLOWED_ALGORITHMS: Algorithm[] = ['RS256'];

let client: JwksClient | undefined;

const getClient = (): JwksClient => {
  if (!client) {
    if (!env.SINCHID_JWT_JWKS_URI) {
      throw new Error('SINCHID_JWT_JWKS_URI is not set: cannot verify SinchID access tokens.');
    }
    client = new JwksClient({
      jwksUri: env.SINCHID_JWT_JWKS_URI,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000, // how long a resolved signing key is reused before refetching
      rateLimit: true,
      jwksRequestsPerMinute: 10, // cooldown: caps refetches even under repeated cache misses
    });
  }
  return client;
};

/** Exposed for unit tests, which point SINCHID_JWT_JWKS_URI at a per-test fake JWKS server. */
export const resetSinchIdJwtVerifierForTests = (): void => {
  client = undefined;
};

/**
 * Verifies a SinchID access token's signature (against the configured JWKS), algorithm, issuer,
 * audience and expiry, and returns the Sinch-namespaced claims it carries. Throws (a
 * `jsonwebtoken` error such as `TokenExpiredError` or `JsonWebTokenError`) for anything that
 * fails verification — an expired, forged, wrong-audience, or wrong-issuer token included.
 */
export const verifySinchIdAccessToken = async (token: string): Promise<SinchUserClaims | undefined> => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header.kid) {
    throw new jwt.JsonWebTokenError('Token header is missing a key id (kid)');
  }

  const signingKey = await getClient().getSigningKey(decoded.header.kid);
  const publicKey = signingKey.getPublicKey();

  const verified = jwt.verify(token, publicKey, {
    algorithms: ALLOWED_ALGORITHMS,
    issuer: env.SINCHID_JWT_ISSUER,
    audience: env.SINCHID_JWT_AUDIENCE,
  });

  if (typeof verified !== 'object') {
    throw new jwt.JsonWebTokenError('Token payload is not a JSON object');
  }

  return mapSinchUserClaims(verified as Record<string, unknown>);
};
