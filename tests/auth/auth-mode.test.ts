/* eslint-disable jest-extended/prefer-to-be-true, jest-extended/prefer-to-be-false */
import type { Request, Response } from 'express';
import { createAuthModeMiddleware, isMcpAuthMode, MCP_AUTH_MODES } from '../../src/auth/auth-mode';
import { AGENT_ID_HEADER } from '../../src/auth/credential-context';
import { resetSinchIdJwtVerifierForTests } from '../../src/auth/sinchid-jwt-verifier';
import { SINCH_ACCOUNT_ID_CLAIM, SINCH_GLOBAL_USER_ID_CLAIM, SINCH_PROJECT_ID_CLAIM } from '../../src/auth/user-jwt';
import { getVerifiedUserClaims } from '../../src/auth/verified-claims';
import { logger } from '../../src/telemetry/logger';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';
import { generateUnpublishedKeyPair, startTestJwksServer, type TestJwksServer } from '../helpers/jwks-server';

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res as Response & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
};

const run = async (mode: (typeof MCP_AUTH_MODES)[number], headers: Record<string, string>) => {
  const req = { headers } as unknown as Request;
  const res = createMockResponse();
  const next = jest.fn();
  await createAuthModeMiddleware(mode)(req, res, next);
  return { req, res, next };
};

const encodeSegment = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const jwt = (payload: Record<string, unknown>): string =>
  `${encodeSegment({ alg: 'RS256' })}.${encodeSegment(payload)}.sig`;

/** base64 of projectId:keyId:keySecret — the client-credentials blob. */
const CREDENTIALS_BLOB = Buffer.from('project-1:key-1:secret-1').toString('base64');
const SINCHID_TOKEN = `Bearer ${jwt({ [SINCH_PROJECT_ID_CLAIM]: 'project-1', sub: 'user-1' })}`;
const REQUIRED_SINCH_CLAIMS = {
  [SINCH_PROJECT_ID_CLAIM]: 'project-1',
  [SINCH_ACCOUNT_ID_CLAIM]: 'account-1',
  [SINCH_GLOBAL_USER_ID_CLAIM]: 'user-1',
  scope: 'openid',
};

describe('isMcpAuthMode', () => {
  it('accepts the configured modes', () => {
    expect(isMcpAuthMode('client-credentials')).toBe(true);
    expect(isMcpAuthMode('sinchid-agent')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isMcpAuthMode('sinchid_agent')).toBe(false);
    expect(isMcpAuthMode('')).toBe(false);
    expect(isMcpAuthMode(undefined)).toBe(false);
  });
});

describe('createAuthModeMiddleware', () => {
  beforeEach(() => {
    resetMockEnv();
  });

  describe('client-credentials', () => {
    it('passes a request whose Authorization decodes to a credential triple', async () => {
      const { res, next } = await run('client-credentials', { authorization: `Bearer ${CREDENTIALS_BLOB}` });

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('ignores x-agent-id: the header is never read by this deployment', async () => {
      const { res, next } = await run('client-credentials', {
        [AGENT_ID_HEADER]: 'order-42',
        authorization: `Bearer ${CREDENTIALS_BLOB}`,
      });

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it.each([
      ['a SinchID JWT', SINCHID_TOKEN],
      ['an opaque token', 'Bearer opaque-api-key'],
      ['a token that decodes without both separators', `Bearer ${Buffer.from('proj:key').toString('base64')}`],
    ])('rejects %s with 401', async (_label, authorization) => {
      const { res, next } = await run('client-credentials', { authorization });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        error: 'invalid_token',
        error_description: 'Authorization must carry Base64 projectId:keyId:keySecret as a Bearer token',
      });
    });

    it('rejects a request with no Authorization using a realm-only challenge', async () => {
      const { res, next } = await run('client-credentials', {});

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe('Bearer realm="sinch-mcp"');
      expect(res.body).toEqual({
        error: 'Unauthorized',
        error_description: 'Missing Sinch API credentials in the Authorization header',
      });
    });
  });

  // Both multi-tenant modes ignore the server's own credentials: a deployment that held any
  // would not be multi-tenant, and createHttpApp refuses to start in that combination. Asserted
  // here so a future change can't quietly make the middleware read them.
  describe('server env credentials', () => {
    it('does not change client-credentials behaviour when set', async () => {
      mockEnv.PROJECT_ID = 'project-1';
      mockEnv.KEY_ID = 'key-1';
      mockEnv.KEY_SECRET = 'secret-1';

      const other = Buffer.from('project-2:key-2:secret-2').toString('base64');
      const { res, next } = await run('client-credentials', { authorization: `Bearer ${other}` });

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  describe('sinchid-agent', () => {
    const ISSUER = 'https://issuer.example/';
    const AUDIENCE = 'https://agent-auth-api-test.sinch.com';
    let server: TestJwksServer;

    beforeAll(async () => {
      server = await startTestJwksServer();
    });

    afterAll(async () => {
      await server.close();
    });

    beforeEach(() => {
      resetSinchIdJwtVerifierForTests();
      mockEnv.SINCHID_JWT_ISSUER = ISSUER;
      mockEnv.SINCHID_JWT_AUDIENCE = AUDIENCE;
      mockEnv.SINCHID_JWT_JWKS_URI = server.url;
    });

    it('passes a request carrying a validly signed SinchID token and x-agent-id, and stashes its verified claims', async () => {
      const token = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1', ...REQUIRED_SINCH_CLAIMS });

      const { req, res, next } = await run('sinchid-agent', {
        authorization: `Bearer ${token}`,
        [AGENT_ID_HEADER]: 'order-42',
      });

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(getVerifiedUserClaims(req)?.subject).toBe('user-1');
      expect(getVerifiedUserClaims(req)?.projectId).toBe('project-1');
    });

    it.each([
      ['a Base64 credential triple', `Bearer ${CREDENTIALS_BLOB}`],
      ['an opaque token', 'Bearer opaque-api-key'],
    ])('rejects %s with 401', async (_label, authorization) => {
      const { res, next } = await run('sinchid-agent', { authorization });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe(
        'Bearer realm="sinch-mcp", error="invalid_token", error_description="Authorization must carry a SinchID access token as a Bearer JWT"',
      );
    });

    it('rejects a request with no Authorization using a realm-only challenge', async () => {
      const { res, next } = await run('sinchid-agent', { [AGENT_ID_HEADER]: 'order-42' });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBe('Bearer realm="sinch-mcp"');
      expect(res.body).toEqual({
        error: 'Unauthorized',
        error_description: 'Missing SinchID access token in the Authorization header',
      });
    });

    it('rejects a SinchID token sent without x-agent-id', async () => {
      const token = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' });
      const { res, next } = await run('sinchid-agent', { authorization: `Bearer ${token}` });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        error: 'invalid_token',
        error_description: `${AGENT_ID_HEADER} is required alongside the SinchID access token`,
      });
    });

    it('rejects a validly signed token that carries none of the expected Sinch claims', async () => {
      const token = server.sign({ iss: ISSUER, aud: AUDIENCE });
      const { res, next } = await run('sinchid-agent', {
        authorization: `Bearer ${token}`,
        [AGENT_ID_HEADER]: 'order-42',
      });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        error: 'invalid_token',
        error_description: 'SinchID access token is missing the expected Sinch claims',
      });
    });

    it('rejects a validly signed token whose only mapped claim is scope', async () => {
      const token = server.sign({ iss: ISSUER, aud: AUDIENCE, scope: 'openid' });
      const { res, next } = await run('sinchid-agent', {
        authorization: `Bearer ${token}`,
        [AGENT_ID_HEADER]: 'order-42',
      });

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        error: 'invalid_token',
        error_description: 'SinchID access token is missing the expected Sinch claims',
      });
    });

    it('returns 503, not 401, when the JWKS endpoint cannot be reached', async () => {
      mockEnv.SINCHID_JWT_JWKS_URI = 'http://127.0.0.1:1/jwks.json';
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
      // Needs a `kid`, or verification fails before ever reaching the JWKS fetch.
      const token = `${encodeSegment({ alg: 'RS256', kid: 'some-kid' })}.${encodeSegment({
        iss: ISSUER,
        aud: AUDIENCE,
        sub: 'user-1',
      })}.sig`;

      try {
        const { res, next } = await run('sinchid-agent', {
          authorization: `Bearer ${token}`,
          [AGENT_ID_HEADER]: 'order-42',
        });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res.headers['Retry-After']).toBe('2');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.objectContaining({ message: expect.any(String) }) }),
          'Could not verify the SinchID access token: the signing-key service is unavailable',
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    // A shape-valid but forged/expired/wrong-audience/wrong-issuer/wrong-signature token must
    // never reach next() — this is the actual vulnerability this auth mode used to have.
    describe('signature/claims verification', () => {
      const headers = (authorization: string) => ({
        authorization: `Bearer ${authorization}`,
        [AGENT_ID_HEADER]: 'order-42',
      });

      it('rejects a forged token that is merely JWT-shaped', async () => {
        const { res, next } = await run(
          'sinchid-agent',
          headers(jwt({ sub: 'attacker', [SINCH_PROJECT_ID_CLAIM]: 'victim-project' })),
        );

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({
          error: 'invalid_token',
          error_description:
            'SinchID access token failed verification (invalid signature, issuer, audience, or expiry)',
        });
      });

      it('rejects an expired token', async () => {
        const token = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, { expiresIn: '-10s' });
        const { res, next } = await run('sinchid-agent', headers(token));

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
      });

      it('rejects a token with the wrong audience', async () => {
        const token = server.sign({ iss: ISSUER, aud: 'https://someone-else.example', sub: 'user-1' });
        const { res, next } = await run('sinchid-agent', headers(token));

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
      });

      it('rejects a token with the wrong issuer', async () => {
        const token = server.sign({ iss: 'https://evil.example/', aud: AUDIENCE, sub: 'user-1' });
        const { res, next } = await run('sinchid-agent', headers(token));

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
      });

      it('rejects a token signed with a key that does not match the published JWKS key', async () => {
        const forgedKey = generateUnpublishedKeyPair();
        const token = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, { privateKey: forgedKey });
        const { res, next } = await run('sinchid-agent', headers(token));

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
      });

      it('returns 401, not 503, for a token carrying an unknown key id', async () => {
        const forgedKey = generateUnpublishedKeyPair();
        const token = server.sign(
          { iss: ISSUER, aud: AUDIENCE, sub: 'user-1' },
          { privateKey: forgedKey, keyid: 'unknown-kid' },
        );
        const { res, next } = await run('sinchid-agent', headers(token));

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.headers['Retry-After']).toBeUndefined();
      });
    });
  });
});
