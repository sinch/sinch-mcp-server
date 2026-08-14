import { AGENT_ID_HEADER, parseAgentIdHeader } from '../../src/auth/agent-id';
import {
  getRequestAgentId,
  getRequestSinchOAuthCredentials,
  runWithHttpCredentialHeaders,
} from '../../src/auth/credential-context';

describe('agent-id', () => {
  describe('parseAgentIdHeader', () => {
    it('returns the trimmed header value', () => {
      expect(parseAgentIdHeader('  order-123  ')).toBe('order-123');
    });

    it('takes the first value when the header is repeated', () => {
      expect(parseAgentIdHeader(['order-a', 'order-b'])).toBe('order-a');
    });

    it('returns undefined for a missing header', () => {
      expect(parseAgentIdHeader(undefined)).toBeUndefined();
    });

    it('returns undefined for an empty or whitespace-only header', () => {
      expect(parseAgentIdHeader('')).toBeUndefined();
      expect(parseAgentIdHeader('   ')).toBeUndefined();
    });
  });

  describe('request context propagation', () => {
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
});
