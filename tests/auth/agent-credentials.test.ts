import {
  clearAgentCredentialsCacheForTests,
  loadAgentCredentials,
  resolveAgentCredentials,
} from '../../src/auth/agent-credentials';
import { buildCredentialCacheKey } from '../../src/auth/sinch-oauth-credentials';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

const validMap = {
  'order-42': {
    projectId: 'project-a',
    accessKeyId: 'key-a',
    accessKeySecret: 'secret-a',
  },
  'order-43': {
    projectId: 'project-b',
    accessKeyId: 'key-b',
    accessKeySecret: 'secret-b',
  },
};

describe('agent-credentials', () => {
  beforeEach(() => {
    resetMockEnv();
    clearAgentCredentialsCacheForTests();
  });

  describe('loadAgentCredentials', () => {
    it('returns an empty map when AGENT_CREDENTIALS is not set', () => {
      expect(loadAgentCredentials().size).toBe(0);
    });

    it('returns an empty map when AGENT_CREDENTIALS is blank', () => {
      mockEnv.AGENT_CREDENTIALS = '   ';
      expect(loadAgentCredentials().size).toBe(0);
    });

    it('parses a valid map into SinchOAuthCredentials entries', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify(validMap);

      const credentials = loadAgentCredentials();

      expect(credentials.size).toBe(2);
      expect(credentials.get('order-42')).toEqual({
        projectId: 'project-a',
        keyId: 'key-a',
        keySecret: 'secret-a',
        cacheKey: buildCredentialCacheKey('project-a', 'key-a', 'secret-a'),
      });
    });

    it('caches the parsed map across calls', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify(validMap);
      const first = loadAgentCredentials();

      // A later env change is not picked up until the cache is cleared.
      mockEnv.AGENT_CREDENTIALS = '{}';
      expect(loadAgentCredentials()).toBe(first);

      clearAgentCredentialsCacheForTests();
      expect(loadAgentCredentials().size).toBe(0);
    });

    it('throws on invalid JSON without echoing the value', () => {
      mockEnv.AGENT_CREDENTIALS = '{secret-blob';

      let error: Error | undefined;
      try {
        loadAgentCredentials();
      } catch (caught) {
        error = caught as Error;
      }

      expect(error?.message).toMatch(/AGENT_CREDENTIALS is not valid JSON/);
      expect(error?.message).not.toContain('secret-blob');
    });

    it('throws when an entry is missing a field', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify({
        'order-42': { projectId: 'project-a', accessKeyId: 'key-a' },
      });
      expect(() => loadAgentCredentials()).toThrow(/invalid shape.*order-42\.accessKeySecret/);
    });

    it('throws when a field is empty', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify({
        'order-42': { projectId: '', accessKeyId: 'key-a', accessKeySecret: 'secret-a' },
      });
      expect(() => loadAgentCredentials()).toThrow(/invalid shape.*order-42\.projectId/);
    });

    it('does not include credential values in shape errors', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify({
        'order-42': { projectId: 'project-a', accessKeyId: 42, accessKeySecret: 'super-secret-value' },
      });

      let error: Error | undefined;
      try {
        loadAgentCredentials();
      } catch (caught) {
        error = caught as Error;
      }

      expect(error?.message).toMatch(/invalid shape/);
      expect(error?.message).not.toContain('super-secret-value');
    });

    it('throws when the value is not an object map', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify(['order-42']);
      expect(() => loadAgentCredentials()).toThrow(/invalid shape/);
    });
  });

  describe('resolveAgentCredentials', () => {
    it('resolves a known agent id', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify(validMap);
      expect(resolveAgentCredentials('order-43')?.projectId).toBe('project-b');
    });

    it('returns undefined for an unknown agent id', () => {
      mockEnv.AGENT_CREDENTIALS = JSON.stringify(validMap);
      expect(resolveAgentCredentials('order-99')).toBeUndefined();
    });

    it('returns undefined when no map is configured', () => {
      expect(resolveAgentCredentials('order-42')).toBeUndefined();
    });
  });
});
