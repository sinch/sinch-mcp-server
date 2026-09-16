import {
  isJwtShapedBearerToken,
  mapSinchUserClaims,
  SINCH_EMAIL_CLAIM,
  SINCH_PROJECT_ID_CLAIM,
} from '../../src/auth/user-jwt';

const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

const buildJwt = (payload: object): string => {
  const header = base64Url({ alg: 'RS256', typ: 'JWT' });
  return `${header}.${base64Url(payload)}.fake-signature`;
};

// Full raw payload shape as issued by Auth0, using mock (non-PII) values.
const examplePayload = {
  'https://sinch.com/account_id': 'mock-account-id',
  'https://sinch.com/project_id': 'mock-project-id',
  email: 'mock-user@example.com',
  'https://sinch.com/email': 'mock-user@example.com',
  'https://sinch.com/global_user_id': 'mock-global-user-id',
  'https://sinch.com/used_mfa': true,
  'https://sinch.com/email_verified': true,
  iss: 'https://id.sinch.com/',
  sub: 'auth0|mock-subject-id',
  aud: ['https://agent-auth-api-test.sinch.com', 'https://sinch.eu.auth0.com/userinfo'],
  iat: 1700000000,
  exp: 1700086400,
  scope: 'openid profile email read:test',
  azp: 'mock-client-id',
};

describe('user-jwt', () => {
  describe('isJwtShapedBearerToken', () => {
    it('is true for a well-formed three-segment JWT', () => {
      expect(isJwtShapedBearerToken(`Bearer ${buildJwt(examplePayload)}`)).toBeTrue();
    });

    it('is false for a missing header', () => {
      expect(isJwtShapedBearerToken(undefined)).toBeFalse();
    });

    it('is false for a non-Bearer scheme', () => {
      expect(isJwtShapedBearerToken(`Basic ${buildJwt(examplePayload)}`)).toBeFalse();
    });

    it('is false for an opaque token such as an MCP API key', () => {
      expect(isJwtShapedBearerToken('Bearer my-static-api-key')).toBeFalse();
    });

    it('is false when the token does not have three segments', () => {
      expect(isJwtShapedBearerToken('Bearer aaa.bbb')).toBeFalse();
      expect(isJwtShapedBearerToken('Bearer aaa.bbb.ccc.ddd')).toBeFalse();
    });

    it('is false when the payload is not valid JSON', () => {
      const invalidPayload = Buffer.from('not-json').toString('base64url');
      expect(isJwtShapedBearerToken(`Bearer aaa.${invalidPayload}.ccc`)).toBeFalse();
    });

    it('is false when the payload is not a JSON object', () => {
      const arrayPayload = Buffer.from(JSON.stringify(['a', 'b'])).toString('base64url');
      expect(isJwtShapedBearerToken(`Bearer aaa.${arrayPayload}.ccc`)).toBeFalse();
    });
  });

  describe('mapSinchUserClaims', () => {
    it('maps the Sinch claims from an (already verified) payload', () => {
      expect(mapSinchUserClaims(examplePayload)).toEqual({
        projectId: 'mock-project-id',
        accountId: 'mock-account-id',
        email: 'mock-user@example.com',
        globalUserId: 'mock-global-user-id',
        subject: 'auth0|mock-subject-id',
        scope: 'openid profile email read:test',
      });
    });

    it('ignores the standard email claim (only the Sinch-namespaced one is audited)', () => {
      const claims = mapSinchUserClaims({ email: 'user@example.com', sub: 'auth0|123' });

      expect(claims?.email).toBeUndefined();
      expect(claims?.subject).toBe('auth0|123');
    });

    it('returns undefined when the payload carries none of the expected claims', () => {
      expect(mapSinchUserClaims({ iss: 'https://id.sinch.com/' })).toBeUndefined();
    });

    it('ignores non-string claim values', () => {
      const claims = mapSinchUserClaims({
        [SINCH_PROJECT_ID_CLAIM]: 42,
        sub: null,
        [SINCH_EMAIL_CLAIM]: 'user@example.com',
      });

      expect(claims?.projectId).toBeUndefined();
      expect(claims?.subject).toBeUndefined();
      expect(claims?.email).toBe('user@example.com');
    });

    it('returns undefined when all claim values are non-string', () => {
      expect(mapSinchUserClaims({ [SINCH_PROJECT_ID_CLAIM]: 42, sub: null })).toBeUndefined();
    });
  });
});
