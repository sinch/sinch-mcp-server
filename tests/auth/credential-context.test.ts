import {
  AGENT_ID_HEADER,
  getRequestAgentId,
  getRequestSinchOAuthCredentials,
  getRequestUserClaims,
  runWithHttpCredentialHeaders,
} from '../../src/auth/credential-context';

describe('credential-context', () => {
  it('exposes the agent id within the request scope', () => {
    const agentId = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () => getRequestAgentId());
    expect(agentId).toBe('order-42');
  });

  it('returns undefined outside a request scope', () => {
    expect(getRequestAgentId()).toBeUndefined();
  });

  it('returns undefined within a request scope when the header is absent', () => {
    const agentId = runWithHttpCredentialHeaders({}, () => getRequestAgentId());
    expect(agentId).toBeUndefined();
  });

  it('captures agent id and credentials independently', () => {
    const authorization = `Bearer ${Buffer.from('proj:key:secret').toString('base64')}`;

    const both = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42', authorization }, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(both.agentId).toBe('order-42');
    expect(both.credentials?.projectId).toBe('proj');

    const agentIdOnly = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(agentIdOnly.agentId).toBe('order-42');
    expect(agentIdOnly.credentials).toBeUndefined();

    const credentialsOnly = runWithHttpCredentialHeaders({ authorization }, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(credentialsOnly.agentId).toBeUndefined();
    expect(credentialsOnly.credentials?.projectId).toBe('proj');
  });

  describe('Sinch credentials in Authorization', () => {
    const encoded = Buffer.from('proj:key:secret').toString('base64');

    it('reads credentials from an Authorization Bearer token', () => {
      const credentials = runWithHttpCredentialHeaders({ authorization: `Bearer ${encoded}` }, () =>
        getRequestSinchOAuthCredentials(),
      );
      expect(credentials?.projectId).toBe('proj');
      expect(credentials?.keyId).toBe('key');
      expect(credentials?.keySecret).toBe('secret');
    });

    it('does not read credentials from the legacy X-Sinch-Credentials header', () => {
      const credentials = runWithHttpCredentialHeaders({ 'x-sinch-credentials': encoded }, () =>
        getRequestSinchOAuthCredentials(),
      );
      expect(credentials).toBeUndefined();
    });

    it.each([
      ['a non-Bearer scheme', `Basic ${encoded}`],
      ['a bare token without scheme', encoded],
      ['an empty Bearer token', 'Bearer '],
      ['a non-Base64 Bearer token', 'Bearer not-base64!!'],
      ['a Bearer token without the two separators', `Bearer ${Buffer.from('proj:key').toString('base64')}`],
    ])('returns undefined for %s', (_label, authorization) => {
      const credentials = runWithHttpCredentialHeaders({ authorization }, () => getRequestSinchOAuthCredentials());
      expect(credentials).toBeUndefined();
    });

    it('does not treat a Bearer user JWT as credentials, and credentials do not yield user claims', () => {
      const payload = Buffer.from(JSON.stringify({ sub: 'auth0|123' })).toString('base64url');
      const jwt = `aaa.${payload}.ccc`;

      const fromJwt = runWithHttpCredentialHeaders({ authorization: `Bearer ${jwt}` }, () => ({
        credentials: getRequestSinchOAuthCredentials(),
        userClaims: getRequestUserClaims(),
      }));
      expect(fromJwt.credentials).toBeUndefined();
      expect(fromJwt.userClaims?.subject).toBe('auth0|123');

      const fromCredentials = runWithHttpCredentialHeaders({ authorization: `Bearer ${encoded}` }, () => ({
        credentials: getRequestSinchOAuthCredentials(),
        userClaims: getRequestUserClaims(),
      }));
      expect(fromCredentials.credentials?.projectId).toBe('proj');
      expect(fromCredentials.userClaims).toBeUndefined();
    });
  });
});
