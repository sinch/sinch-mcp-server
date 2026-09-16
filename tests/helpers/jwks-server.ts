import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt, { type SignOptions } from 'jsonwebtoken';

/**
 * A throwaway HTTP server serving a real JWKS document over `GET /jwks.json`, backed by a
 * freshly generated RSA key pair. Lets tests sign real JWTs and verify them through
 * `verifySinchIdAccessToken` / the `sinchid-agent` auth mode end-to-end, without mocking
 * `jwks-rsa`'s HTTP layer.
 */
export type TestJwksServer = {
  url: string;
  kid: string;
  privateKey: KeyObject;
  /** Number of requests the fake JWKS endpoint has served — used to assert caching behaviour. */
  requestCount: () => number;
  /** Signs a token with the published key pair unless `privateKey`/`kid` are overridden. */
  sign: (payload: Record<string, unknown>, options?: SignOptions & { privateKey?: KeyObject }) => string;
  close: () => Promise<void>;
};

const toJwks = (kid: string, publicKey: KeyObject) => ({
  keys: [{ ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid, use: 'sig', alg: 'RS256' }],
});

export const startTestJwksServer = async (): Promise<TestJwksServer> => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key-1';
  const jwks = toJwks(kid, publicKey);
  let requests = 0;

  const server: Server = http.createServer((_req, res) => {
    requests += 1;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(jwks));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}/jwks.json`,
    kid,
    privateKey,
    requestCount: () => requests,
    sign: (payload, options = {}) => {
      const { privateKey: signingKey = privateKey, ...signOptions } = options;
      return jwt.sign(payload, signingKey, {
        algorithm: 'RS256',
        keyid: kid,
        ...signOptions,
      });
    },
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
};

/** A second, unpublished key pair — for signing a token whose signature won't match the JWKS. */
export const generateUnpublishedKeyPair = (): KeyObject =>
  generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
