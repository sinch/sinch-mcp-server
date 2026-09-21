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

  it('caches the resolved signing key across verifications sharing the same kid', async () => {
    const first = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-1' });
    const second = server.sign({ iss: ISSUER, aud: AUDIENCE, sub: 'user-2' });
    const requestsBefore = server.requestCount();

    await verifySinchIdAccessToken(first);
    await verifySinchIdAccessToken(second);

    expect(server.requestCount() - requestsBefore).toBe(1);
  });
});
