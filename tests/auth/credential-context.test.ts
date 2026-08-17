import {
  AGENT_ID_HEADER,
  getRequestAgentId,
  getRequestSinchOAuthCredentials,
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
    const encoded = Buffer.from('proj:key:secret').toString('base64');

    const both = runWithHttpCredentialHeaders(
      { [AGENT_ID_HEADER]: 'order-42', 'x-sinch-credentials': encoded },
      () => ({
        agentId: getRequestAgentId(),
        credentials: getRequestSinchOAuthCredentials(),
      }),
    );
    expect(both.agentId).toBe('order-42');
    expect(both.credentials?.projectId).toBe('proj');

    const agentIdOnly = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(agentIdOnly.agentId).toBe('order-42');
    expect(agentIdOnly.credentials).toBeUndefined();

    const credentialsOnly = runWithHttpCredentialHeaders({ 'x-sinch-credentials': encoded }, () => ({
      agentId: getRequestAgentId(),
      credentials: getRequestSinchOAuthCredentials(),
    }));
    expect(credentialsOnly.agentId).toBeUndefined();
    expect(credentialsOnly.credentials?.projectId).toBe('proj');
  });
});
