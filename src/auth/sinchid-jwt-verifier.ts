import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import { JwksClient, SigningKeyNotFoundError } from 'jwks-rsa';
import { env } from '../env';

// Pinned, not env-configurable: the token's own `alg` header must never decide which algorithm
// (or key type) verification uses — that is exactly the "alg confusion" class of attack.
const ALLOWED_ALGORITHMS: Algorithm[] = ['RS256'];
const JWKS_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const JWKS_REFRESH_COOLDOWN_MS = 30 * 1000;
const JWKS_STALE_MAX_AGE_MS = 60 * 60 * 1000;

type SigningKey = Awaited<ReturnType<JwksClient['getSigningKeys']>>[number];
type SigningKeyCache = { keys: SigningKey[]; fetchedAt: number };

let client: JwksClient | undefined;
let signingKeyCache: SigningKeyCache | undefined;
let refreshPromise: Promise<SigningKeyCache> | undefined;
let lastRefreshAttemptAt: number | undefined;
let lastRefreshError: unknown;

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
    lastRefreshAttemptAt = Date.now();
    refreshPromise = getClient()
      .getSigningKeys()
      .then((keys) => {
        signingKeyCache = { keys, fetchedAt: Date.now() };
        lastRefreshError = undefined;
        return signingKeyCache;
      })
      .catch((error: unknown) => {
        lastRefreshError = error;
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
};

const findSigningKey = (keys: SigningKey[], kid: string): SigningKey | undefined => keys.find((key) => key.kid === kid);

const refreshIsCoolingDown = (): boolean =>
  lastRefreshAttemptAt !== undefined && Date.now() - lastRefreshAttemptAt < JWKS_REFRESH_COOLDOWN_MS;

const refreshSigningKeysIfAllowed = async (): Promise<SigningKeyCache | undefined> => {
  if (refreshPromise) {
    return refreshPromise;
  }
  return refreshIsCoolingDown() ? undefined : refreshSigningKeys();
};

const getSigningKey = async (kid: string): Promise<SigningKey> => {
  let cache = signingKeyCache;
  if (!cache) {
    cache = await refreshSigningKeysIfAllowed();
    if (!cache) {
      throw lastRefreshError ?? new Error('JWKS refresh is cooling down after a failed attempt');
    }
  }

  let signingKey = findSigningKey(cache.keys, kid);
  if (signingKey) {
    if (Date.now() - cache.fetchedAt >= JWKS_REFRESH_INTERVAL_MS) {
      let refreshedCache: SigningKeyCache | undefined;
      try {
        refreshedCache = await refreshSigningKeysIfAllowed();
      } catch (error) {
        // Keep using a known cached key during a transient JWKS outage. Its JWT must still pass
        // signature and expiry validation; a successful later refresh can remove the stale key.
        if (Date.now() - cache.fetchedAt < JWKS_STALE_MAX_AGE_MS) {
          return signingKey;
        }
        throw error;
      }

      if (refreshedCache) {
        signingKey = findSigningKey(refreshedCache.keys, kid);
        if (!signingKey) {
          throw new SigningKeyNotFoundError(`Unable to find a signing key that matches '${kid}'`);
        }
      } else if (lastRefreshError && Date.now() - cache.fetchedAt >= JWKS_STALE_MAX_AGE_MS) {
        throw lastRefreshError;
      }
    }
    return signingKey;
  }

  // An unknown kid can prompt one complete-document refresh per cooldown. Junk kids therefore
  // cannot consume a shared lookup budget, while a newly published key is picked up promptly.
  cache = await refreshSigningKeysIfAllowed();
  if (cache) {
    signingKey = findSigningKey(cache.keys, kid);
    if (signingKey) {
      return signingKey;
    }
  } else if (lastRefreshError) {
    // The latest refresh failed and the cooldown is based on that attempt, not the last success.
    // An unknown kid may be a newly rotated key, so report verification unavailable rather than
    // claiming the token is invalid without being able to consult the issuer.
    throw lastRefreshError;
  }

  throw new SigningKeyNotFoundError(`Unable to find a signing key that matches '${kid}'`);
};

/** Exposed for unit tests, which point SINCHID_JWT_JWKS_URI at a per-test fake JWKS server. */
export const resetSinchIdJwtVerifierForTests = (): void => {
  client = undefined;
  signingKeyCache = undefined;
  refreshPromise = undefined;
  lastRefreshAttemptAt = undefined;
  lastRefreshError = undefined;
};

/**
 * Verifies signature, algorithm, issuer, audience, expiry and presence of `exp`, and returns the
 * decoded payload — callers parse Sinch claims out of it themselves (see `parseSinchUserClaims`). A
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
