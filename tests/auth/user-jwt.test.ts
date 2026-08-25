import { decodeUserJwtHeader, SINCH_EMAIL_CLAIM, SINCH_PROJECT_ID_CLAIM } from '../../src/auth/user-jwt';
import { AGENT_ID_HEADER, getRequestUserClaims, runWithHttpCredentialHeaders } from '../../src/auth/credential-context';

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
  describe('decodeUserJwtHeader', () => {
    it('maps the Sinch claims from a Bearer JWT', () => {
      const claims = decodeUserJwtHeader(`Bearer ${buildJwt(examplePayload)}`);

      expect(claims).toEqual({
        projectId: 'mock-project-id',
        accountId: 'mock-account-id',
        email: 'mock-user@example.com',
        globalUserId: 'mock-global-user-id',
        subject: 'auth0|mock-subject-id',
        scope: 'openid profile email read:test',
      });
    });

    it('ignores the standard email claim (only the Sinch-namespaced one is audited)', () => {
      const claims = decodeUserJwtHeader(`Bearer ${buildJwt({ email: 'user@example.com', sub: 'auth0|123' })}`);

      expect(claims?.email).toBeUndefined();
      expect(claims?.subject).toBe('auth0|123');
    });

    it('returns undefined when the JWT carries none of the expected claims', () => {
      expect(decodeUserJwtHeader(`Bearer ${buildJwt({ iss: 'https://id.sinch.com/' })}`)).toBeUndefined();
    });

    it('ignores non-string claim values', () => {
      const claims = decodeUserJwtHeader(
        `Bearer ${buildJwt({ [SINCH_PROJECT_ID_CLAIM]: 42, sub: null, [SINCH_EMAIL_CLAIM]: 'user@example.com' })}`,
      );

      expect(claims?.projectId).toBeUndefined();
      expect(claims?.subject).toBeUndefined();
      expect(claims?.email).toBe('user@example.com');
    });

    it('returns undefined when all claim values are non-string', () => {
      expect(decodeUserJwtHeader(`Bearer ${buildJwt({ [SINCH_PROJECT_ID_CLAIM]: 42, sub: null })}`)).toBeUndefined();
    });

    it('returns undefined for a missing header', () => {
      expect(decodeUserJwtHeader(undefined)).toBeUndefined();
    });

    it('returns undefined for a non-Bearer scheme', () => {
      expect(decodeUserJwtHeader(`Basic ${buildJwt(examplePayload)}`)).toBeUndefined();
    });

    it('returns undefined for an opaque token such as an MCP API key', () => {
      expect(decodeUserJwtHeader('Bearer my-static-api-key')).toBeUndefined();
    });

    it('returns undefined when the token does not have three segments', () => {
      expect(decodeUserJwtHeader('Bearer aaa.bbb')).toBeUndefined();
      expect(decodeUserJwtHeader('Bearer aaa.bbb.ccc.ddd')).toBeUndefined();
    });

    it('returns undefined when the payload is not valid JSON', () => {
      const invalidPayload = Buffer.from('not-json').toString('base64url');
      expect(decodeUserJwtHeader(`Bearer aaa.${invalidPayload}.ccc`)).toBeUndefined();
    });

    it('returns undefined when the payload is not a JSON object', () => {
      const arrayPayload = Buffer.from(JSON.stringify(['a', 'b'])).toString('base64url');
      expect(decodeUserJwtHeader(`Bearer aaa.${arrayPayload}.ccc`)).toBeUndefined();
    });
  });

  describe('request context propagation', () => {
    it('exposes the user claims within the request scope', () => {
      const claims = runWithHttpCredentialHeaders({ authorization: `Bearer ${buildJwt(examplePayload)}` }, () =>
        getRequestUserClaims(),
      );

      expect(claims?.projectId).toBe('mock-project-id');
      expect(claims?.email).toBe('mock-user@example.com');
    });

    it('returns undefined outside a request scope', () => {
      expect(getRequestUserClaims()).toBeUndefined();
    });

    it('returns undefined within a request scope when the header is absent', () => {
      const claims = runWithHttpCredentialHeaders({}, () => getRequestUserClaims());
      expect(claims).toBeUndefined();
    });

    it('captures user claims independently from the agent id', () => {
      const context = runWithHttpCredentialHeaders(
        {
          authorization: `Bearer ${buildJwt(examplePayload)}`,
          [AGENT_ID_HEADER]: 'order-42',
        },
        () => getRequestUserClaims(),
      );
      expect(context?.globalUserId).toBe('mock-global-user-id');

      const withoutJwt = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () => getRequestUserClaims());
      expect(withoutJwt).toBeUndefined();
    });
  });
});
