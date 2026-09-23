import {
  isJwtShapedToken,
  parseSinchUserClaims,
  SINCH_ACCOUNT_ID_CLAIM,
  SINCH_EMAIL_CLAIM,
  SINCH_GLOBAL_USER_ID_CLAIM,
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

const parsedClaims = (payload: Record<string, unknown>) => {
  const result = parseSinchUserClaims(payload);
  return result.ok ? result.claims : undefined;
};

describe('user-jwt', () => {
  describe('isJwtShapedToken', () => {
    it('is true for a well-formed three-segment JWT', () => {
      expect(isJwtShapedToken(buildJwt(examplePayload))).toBeTrue();
    });

    it('is false for an opaque token such as an MCP API key', () => {
      expect(isJwtShapedToken('my-static-api-key')).toBeFalse();
    });

    it('is false when the token does not have three segments', () => {
      expect(isJwtShapedToken('aaa.bbb')).toBeFalse();
      expect(isJwtShapedToken('aaa.bbb.ccc.ddd')).toBeFalse();
    });

    it('is false when the payload is not valid JSON', () => {
      const invalidPayload = Buffer.from('not-json').toString('base64url');
      expect(isJwtShapedToken(`aaa.${invalidPayload}.ccc`)).toBeFalse();
    });

    it('is false when the payload is not a JSON object', () => {
      const arrayPayload = Buffer.from(JSON.stringify(['a', 'b'])).toString('base64url');
      expect(isJwtShapedToken(`aaa.${arrayPayload}.ccc`)).toBeFalse();
    });
  });

  describe('parseSinchUserClaims', () => {
    it('maps the Sinch claims from an (already verified) payload', () => {
      expect(parsedClaims(examplePayload)).toEqual({
        projectId: 'mock-project-id',
        accountId: 'mock-account-id',
        email: 'mock-user@example.com',
        globalUserId: 'mock-global-user-id',
        subject: 'auth0|mock-subject-id',
        scope: 'openid profile email read:test',
      });
    });

    it.each([
      [SINCH_PROJECT_ID_CLAIM, 'project_id'],
      [SINCH_ACCOUNT_ID_CLAIM, 'account_id'],
      [SINCH_GLOBAL_USER_ID_CLAIM, 'global_user_id'],
      ['scope', 'scope'],
    ] as const)('reports required claim %s when it is missing', (claim, publicName) => {
      const incompletePayload: Record<string, unknown> = { ...examplePayload };
      delete incompletePayload[claim];

      expect(parseSinchUserClaims(incompletePayload)).toEqual({
        ok: false,
        issues: [{ claim: publicName, code: 'missing' }],
      });
    });

    it('rejects empty, whitespace, or non-string values for every required claim', () => {
      const requiredClaims = [SINCH_PROJECT_ID_CLAIM, SINCH_ACCOUNT_ID_CLAIM, SINCH_GLOBAL_USER_ID_CLAIM, 'scope'];
      const invalidValues: unknown[] = ['', '   ', null, 42, []];

      for (const claim of requiredClaims) {
        for (const invalidValue of invalidValues) {
          const publicName = claim === 'scope' ? 'scope' : claim.match(/[^/]+$/)?.[0];
          expect(parseSinchUserClaims({ ...examplePayload, [claim]: invalidValue })).toEqual({
            ok: false,
            issues: [
              {
                claim: publicName,
                code: typeof invalidValue === 'string' ? 'blank' : 'not_string',
              },
            ],
          });
        }
      }
    });

    it('does not accept inherited properties as required claims', () => {
      const inheritedProject = Object.create({ [SINCH_PROJECT_ID_CLAIM]: 'inherited-project' }) as Record<
        string,
        unknown
      >;
      Object.assign(inheritedProject, {
        [SINCH_ACCOUNT_ID_CLAIM]: 'account-1',
        [SINCH_GLOBAL_USER_ID_CLAIM]: 'user-1',
        scope: 'openid',
      });

      expect(parseSinchUserClaims(inheritedProject)).toEqual({
        ok: false,
        issues: [{ claim: 'project_id', code: 'missing' }],
      });
    });

    it('does not accept standard claims without a Sinch audit identity', () => {
      expect(parsedClaims({ email: 'user@example.com', sub: 'auth0|123', scope: 'openid' })).toBeUndefined();
    });

    it('returns undefined when the payload carries none of the expected claims', () => {
      expect(parsedClaims({ iss: 'https://id.sinch.com/' })).toBeUndefined();
    });

    it('ignores non-string claim values', () => {
      const claims = parsedClaims({
        [SINCH_PROJECT_ID_CLAIM]: 'project-1',
        [SINCH_ACCOUNT_ID_CLAIM]: 'account-1',
        [SINCH_GLOBAL_USER_ID_CLAIM]: 'user-1',
        scope: 'openid',
        sub: null,
        [SINCH_EMAIL_CLAIM]: 42,
      });

      expect(claims?.subject).toBeUndefined();
      expect(claims?.email).toBeUndefined();
      expect(claims?.projectId).toBe('project-1');
      expect(claims?.accountId).toBe('account-1');
    });

    it('returns undefined when all claim values are non-string', () => {
      expect(parsedClaims({ [SINCH_PROJECT_ID_CLAIM]: 42, sub: null })).toBeUndefined();
    });
  });
});
