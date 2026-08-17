import {
  decodeUserJwtHeader,
  SINCH_ACCOUNT_ID_CLAIM,
  SINCH_EMAIL_CLAIM,
  SINCH_GLOBAL_USER_ID_CLAIM,
  SINCH_PROJECT_ID_CLAIM,
} from '../../src/auth/user-jwt';
import { AGENT_ID_HEADER, getRequestUserClaims, runWithHttpCredentialHeaders } from '../../src/auth/credential-context';

const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

const buildJwt = (payload: object): string => {
  const header = base64Url({ alg: 'RS256', typ: 'JWT' });
  return `${header}.${base64Url(payload)}.fake-signature`;
};

const examplePayload = {
  [SINCH_ACCOUNT_ID_CLAIM]: '244b24e9dd2a45a19547f8c372d6fcab',
  [SINCH_PROJECT_ID_CLAIM]: 'd1b9c2af-fca6-49a7-8c84-7bdc9c4c50e4',
  email: 'antoine.sein@mailgun.com',
  [SINCH_EMAIL_CLAIM]: 'antoine.sein@mailgun.com',
  [SINCH_GLOBAL_USER_ID_CLAIM]: '81ac881a-5777-4300-aafc-3d3ca6f73115',
  iss: 'https://id.sinch.com/',
  sub: 'auth0|664336b8d1aa73fd26ec6068',
};

describe('user-jwt', () => {
  describe('decodeUserJwtHeader', () => {
    it('maps the Sinch claims from a Bearer JWT', () => {
      const claims = decodeUserJwtHeader(`Bearer ${buildJwt(examplePayload)}`);

      expect(claims).toEqual({
        projectId: 'd1b9c2af-fca6-49a7-8c84-7bdc9c4c50e4',
        accountId: '244b24e9dd2a45a19547f8c372d6fcab',
        email: 'antoine.sein@mailgun.com',
        globalUserId: '81ac881a-5777-4300-aafc-3d3ca6f73115',
        subject: 'auth0|664336b8d1aa73fd26ec6068',
      });
    });

    it('falls back to the standard email claim when the Sinch one is absent', () => {
      const claims = decodeUserJwtHeader(`Bearer ${buildJwt({ email: 'user@example.com' })}`);
      expect(claims?.email).toBe('user@example.com');
    });

    it('leaves unknown claims undefined', () => {
      const claims = decodeUserJwtHeader(`Bearer ${buildJwt({ iss: 'https://id.sinch.com/' })}`);

      expect(claims).toEqual({
        projectId: undefined,
        accountId: undefined,
        email: undefined,
        globalUserId: undefined,
        subject: undefined,
      });
    });

    it('ignores non-string claim values', () => {
      const claims = decodeUserJwtHeader(`Bearer ${buildJwt({ [SINCH_PROJECT_ID_CLAIM]: 42, sub: null })}`);

      expect(claims?.projectId).toBeUndefined();
      expect(claims?.subject).toBeUndefined();
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

      expect(claims?.projectId).toBe('d1b9c2af-fca6-49a7-8c84-7bdc9c4c50e4');
      expect(claims?.email).toBe('antoine.sein@mailgun.com');
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
      expect(context?.globalUserId).toBe('81ac881a-5777-4300-aafc-3d3ca6f73115');

      const withoutJwt = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () => getRequestUserClaims());
      expect(withoutJwt).toBeUndefined();
    });
  });
});
