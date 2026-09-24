import {
  AGENT_ID_HEADER,
  getRequestAgentId,
  getRequestAgentSinchOAuthCredentials,
  getRequestSinchOAuthCredentials,
  getRequestUserClaims,
  runWithHttpCredentialHeaders,
} from '../../src/auth/credential-context';

describe('credential-context', () => {
  it('exposes the agent id within the request scope', () => {
    const agentId = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, undefined, () =>
      getRequestAgentId(),
    );
    expect(agentId).toBe('order-42');
  });

  it('returns undefined outside a request scope', () => {
    expect(getRequestAgentId()).toBeUndefined();
  });

  it('returns undefined within a request scope when the header is absent', () => {
    const agentId = runWithHttpCredentialHeaders({}, undefined, () => getRequestAgentId());
    expect(agentId).toBeUndefined();
  });

  it('captures agent id and credentials independently', () => {
    const authorization = `Bearer ${Buffer.from('proj:key:secret').toString('base64')}`;

    const both = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42', authorization }, undefined, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(both.agentId).toBe('order-42');
    expect(both.credentials?.projectId).toBe('proj');

    const agentIdOnly = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, undefined, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(agentIdOnly.agentId).toBe('order-42');
    expect(agentIdOnly.credentials).toBeUndefined();

    const credentialsOnly = runWithHttpCredentialHeaders({ authorization }, undefined, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(credentialsOnly.agentId).toBeUndefined();
    expect(credentialsOnly.credentials?.projectId).toBe('proj');
  });

  it('keeps preloaded agent credentials separate from Authorization credentials', () => {
    const authorization = `Bearer ${Buffer.from('header-project:header-key:header-secret').toString('base64')}`;
    const agentCredentials = {
      projectId: 'agent-project',
      keyId: 'agent-key',
      keySecret: 'agent-secret',
      cacheKey: 'agent-cache-key',
    };

    const credentials = runWithHttpCredentialHeaders(
      { [AGENT_ID_HEADER]: 'order-42', authorization },
      { projectId: 'agent-project' },
      () => ({
        header: getRequestSinchOAuthCredentials(),
        agent: getRequestAgentSinchOAuthCredentials(),
      }),
      agentCredentials,
    );

    expect(credentials.header?.projectId).toBe('header-project');
    expect(credentials.agent).toBe(agentCredentials);
  });

  describe('Sinch credentials in Authorization', () => {
    const encoded = Buffer.from('proj:key:secret').toString('base64');

    it('reads credentials from an Authorization Bearer token', () => {
      const credentials = runWithHttpCredentialHeaders({ authorization: `Bearer ${encoded}` }, undefined, () =>
        getRequestSinchOAuthCredentials(),
      );
      expect(credentials?.projectId).toBe('proj');
      expect(credentials?.keyId).toBe('key');
      expect(credentials?.keySecret).toBe('secret');
    });

    it('does not read credentials from unrelated headers', () => {
      const credentials = runWithHttpCredentialHeaders({ 'other-header': encoded }, undefined, () =>
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
      const credentials = runWithHttpCredentialHeaders({ authorization }, undefined, () =>
        getRequestSinchOAuthCredentials(),
      );
      expect(credentials).toBeUndefined();
    });

    it('does not treat a Bearer user JWT as credentials, and never derives user claims from the header itself', () => {
      // userClaims is no longer decoded from Authorization here — it must be passed in already
      // verified (see sinchid-jwt-verifier.ts). A JWT-shaped Authorization header on its own
      // yields no claims, however plausible its (unverified) payload looks.
      const payload = Buffer.from(JSON.stringify({ sub: 'auth0|123' })).toString('base64url');
      const jwt = `aaa.${payload}.ccc`;

      const fromJwt = runWithHttpCredentialHeaders({ authorization: `Bearer ${jwt}` }, undefined, () => ({
        credentials: getRequestSinchOAuthCredentials(),
        userClaims: getRequestUserClaims(),
      }));
      expect(fromJwt.credentials).toBeUndefined();
      expect(fromJwt.userClaims).toBeUndefined();

      const fromCredentials = runWithHttpCredentialHeaders({ authorization: `Bearer ${encoded}` }, undefined, () => ({
        credentials: getRequestSinchOAuthCredentials(),
        userClaims: getRequestUserClaims(),
      }));
      expect(fromCredentials.credentials?.projectId).toBe('proj');
      expect(fromCredentials.userClaims).toBeUndefined();
    });

    it('propagates explicitly-passed verified claims independently of Authorization/agent id', () => {
      const verifiedClaims = { subject: 'auth0|123', projectId: 'project-1' };

      const withClaims = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-42', authorization: `Bearer ${encoded}` },
        verifiedClaims,
        () => ({
          agentId: getRequestAgentId(),
          credentials: getRequestSinchOAuthCredentials(),
          userClaims: getRequestUserClaims(),
        }),
      );

      expect(withClaims.agentId).toBe('order-42');
      expect(withClaims.credentials?.projectId).toBe('proj');
      expect(withClaims.userClaims).toEqual(verifiedClaims);
    });
  });
});
