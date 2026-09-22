import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import { JwksClient, SigningKeyNotFoundError } from 'jwks-rsa';
import { env } from '../env';

// Pinned, not env-configurable: the token's own `alg` header must never decide which algorithm
// (or key type) verification uses — that is exactly the "alg confusion" class of attack.
const ALLOWED_ALGORITHMS: Algorithm[] = ['RS256'];
const JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const JWKS_REFRESH_COOLDOWN_MS = 30 * 1000;

type SigningKey = Awaited<ReturnType<JwksClient['getSigningKeys']>>[number];
type SigningKeyCache = { keys: SigningKey[]; refreshedAt: number };

let client: JwksClient | undefined;
let signingKeyCache: SigningKeyCache | undefined;
let refreshPromise: Promise<SigningKeyCache> | undefined;

const getClient = (): JwksClient => {
  if (!client) {
    if (!env.SINCHID_JWT_JWKS_URI) {
      throw new Error('SINCHID_JWT_JWKS_URI is not set: cannot verify SinchID access tokens.');
    }
    client = new JwksClient({
      jwksUri: env.SINCHID_JWT_JWKS_URI,
      // Cache the complete document below. Per-kid caching plus a shared request-rate budget lets
      // random kids exhaust the budget and block a legitimate key that has not been cached yet.
      cache: false,
      rateLimit: false,
    });
  }
  return client;
};

const refreshSigningKeys = async (): Promise<SigningKeyCache> => {
  if (!refreshPromise) {
    refreshPromise = getClient()
      .getSigningKeys()
      .then((keys) => {
        signingKeyCache = { keys, refreshedAt: Date.now() };
        return signingKeyCache;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
};

const findSigningKey = (keys: SigningKey[], kid: string): SigningKey | undefined => keys.find((key) => key.kid === kid);

const getSigningKey = async (kid: string): Promise<SigningKey> => {
  let cache = signingKeyCache;
  if (!cache || Date.now() - cache.refreshedAt >= JWKS_CACHE_MAX_AGE_MS) {
    cache = await refreshSigningKeys();
  }

  let signingKey = findSigningKey(cache.keys, kid);
  if (signingKey) {
    return signingKey;
  }

  // An unknown kid can prompt one complete-document refresh per cooldown. Junk kids therefore
  // cannot consume a shared lookup budget, while a newly published key is picked up promptly.
  if (Date.now() - cache.refreshedAt >= JWKS_REFRESH_COOLDOWN_MS) {
    cache = await refreshSigningKeys();
    signingKey = findSigningKey(cache.keys, kid);
    if (signingKey) {
      return signingKey;
    }
  }

  throw new SigningKeyNotFoundError(`Unable to find a signing key that matches '${kid}'`);
};

/** Exposed for unit tests, which point SINCHID_JWT_JWKS_URI at a per-test fake JWKS server. */
export const resetSinchIdJwtVerifierForTests = (): void => {
  client = undefined;
  signingKeyCache = undefined;
  refreshPromise = undefined;
};

/**
 * Verifies signature, algorithm, issuer, audience, expiry and presence of `exp`, and returns the
 * decoded payload — callers map Sinch claims out of it themselves (see `mapSinchUserClaims`). A
 * `jsonwebtoken` error means the token itself is invalid; anything else means verification
 * couldn't run at all (e.g. JWKS unreachable) — see `auth-mode.ts`.
 */
export const verifySinchIdAccessToken = async (token: string): Promise<JwtPayload> => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header.kid) {
    throw new jwt.JsonWebTokenError('Token header is missing a key id (kid)');
  }

  const signingKey = await getSigningKey(decoded.header.kid);
  const publicKey = signingKey.getPublicKey();

  const verified = jwt.verify(token, publicKey, {
    algorithms: ALLOWED_ALGORITHMS,
    issuer: env.SINCHID_JWT_ISSUER,
    audience: env.SINCHID_JWT_AUDIENCE,
  });

  if (typeof verified !== 'object') {
    throw new jwt.JsonWebTokenError('Token payload is not a JSON object');
  }

  // jsonwebtoken only enforces expiry when `exp` is present — an exp-less token would else verify forever.
  if (typeof verified.exp !== 'number') {
    throw new jwt.JsonWebTokenError('Token is missing an exp claim');
  }

  return verified;
};
