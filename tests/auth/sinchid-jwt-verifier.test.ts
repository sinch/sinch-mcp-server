import jwt from 'jsonwebtoken';
import { resetSinchIdJwtVerifierForTests, verifySinchIdAccessToken } from '../../src/auth/sinchid-jwt-verifier';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';
import { generateUnpublishedKeyPair, startTestJwksServer, type TestJwksServer } from '../helpers/jwks-server';

const ISSUER = 'https://issuer.example/';
const AUDIENCE = 'https://agent-auth-api-test.sinch.com';

describe('verifySinchIdAccessToken', () => {
  let server: TestJwksServer;

  beforeAll(async () => {
    server = await startTestJwksServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    resetMockEnv();
    resetSinchIdJwtVerifierForTests();
    mockEnv.SINCHID_JWT_ISSUER = ISSUER;
    mockEnv.SINCHID_JWT_AUDIENCE = AUDIENCE;
    mockEnv.SINCHID_JWT_JWKS_URI = server.url;
  });

  it('verifies a validly signed token and returns its decoded payload', async () => {
    const token = server.sign({
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'auth0|user-1',
      'https://sinch.com/project_id': 'project-1',
    });

    const payload = await verifySinchIdAccessToken(token);

    expect(payload.sub).toBe('auth0|user-1');
    expect(payload['https://sinch.com/project_id']).toBe('project-1');
  });

  it('rejects a token with no exp claim', async () => {
    // Bypasses `server.sign`'s default expiry: this is the one case that must have none.
    const token = jwt.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, server.privateKey, {
      algorithm: 'RS256',
      keyid: server.kid,
    });

    await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/exp/i);
  });

  it('rejects an expired token', async () => {
    const token = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, { expiresIn: '-10s' });

    await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/expired/i);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = server.sign({ iss: ISSUER, aud: 'https://someone-else.example', sub: 'user-1' });

    await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/audience/i);
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = server.sign({ iss: 'https://evil.example/', aud: AUDIENCE, sub: 'user-1' });

    await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/issuer/i);
  });

  it('rejects a token signed with a key that does not match the published JWKS key', async () => {
    const forgedKey = generateUnpublishedKeyPair();
    const token = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, { privateKey: forgedKey });

    await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/signature/i);
  });

  it('rejects a token asserting alg: none, even though it is otherwise well-formed', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: server.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' })).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;

    await expect(verifySinchIdAccessToken(unsignedToken)).rejects.toThrow();
  });

  it('rejects an HMAC-signed token even when it names a published RSA key', async () => {
    const token = jwt.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' }, 'attacker-controlled-secret', {
      algorithm: 'HS256',
      keyid: server.kid,
      expiresIn: '1h',
    });

    await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/algorithm/i);
  });

  it('caches the resolved signing key across verifications sharing the same kid', async () => {
    const first = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' });
    const second = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-2' });
    const requestsBefore = server.requestCount();

    await verifySinchIdAccessToken(first);
    await verifySinchIdAccessToken(second);

    expect(server.requestCount() - requestsBefore).toBe(1);
  });

  it('does not let a flood of unknown kids block a key published in the cached JWKS', async () => {
    const unknownKey = generateUnpublishedKeyPair();
    const requestsBefore = server.requestCount();

    for (let index = 0; index < 12; index += 1) {
      const token = server.sign(
        { iss: ISSUER, aud: AUDIENCE, sub: `attacker-${index}` },
        { privateKey: unknownKey, keyid: `unknown-${index}` },
      );
      await expect(verifySinchIdAccessToken(token)).rejects.toThrow(/signing key/i);
    }

    const validToken = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'legitimate-user' });
    await expect(verifySinchIdAccessToken(validToken)).resolves.toMatchObject({ sub: 'legitimate-user' });
    expect(server.requestCount() - requestsBefore).toBe(1);
  });

  it('allows only one unknown-kid refresh per cooldown window', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const unknownKey = generateUnpublishedKeyPair();

    try {
      const validToken = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'legitimate-user' });
      await verifySinchIdAccessToken(validToken);
      const requestsAfterWarmup = server.requestCount();

      now.mockReturnValue(1_031_000);
      const firstUnknown = server.sign(
        { iss: ISSUER, aud: AUDIENCE, sub: 'attacker-1' },
        { privateKey: unknownKey, keyid: 'unknown-after-cooldown-1' },
      );
      await expect(verifySinchIdAccessToken(firstUnknown)).rejects.toThrow(/signing key/i);

      const secondUnknown = server.sign(
        { iss: ISSUER, aud: AUDIENCE, sub: 'attacker-2' },
        { privateKey: unknownKey, keyid: 'unknown-after-cooldown-2' },
      );
      await expect(verifySinchIdAccessToken(secondUnknown)).rejects.toThrow(/signing key/i);

      expect(server.requestCount() - requestsAfterWarmup).toBe(1);
    } finally {
      now.mockRestore();
    }
  });

  it('picks up a newly published signing key on the first refresh after the cooldown', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);

    try {
      await verifySinchIdAccessToken(server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'before-rotation' }));
      const requestsAfterWarmup = server.requestCount();
      const rotatedKey = server.publishKey();
      const rotatedToken = server.sign(
        { iss: ISSUER, aud: AUDIENCE, sub: 'after-rotation' },
        { privateKey: rotatedKey.privateKey, keyid: rotatedKey.kid },
      );

      now.mockReturnValue(2_031_000);

      await expect(verifySinchIdAccessToken(rotatedToken)).resolves.toMatchObject({ sub: 'after-rotation' });
      expect(server.requestCount() - requestsAfterWarmup).toBe(1);
    } finally {
      now.mockRestore();
    }
  });
});
