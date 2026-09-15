import { clearAgentCredentialsCacheForTests } from '../../src/auth/agent-credentials';
import { clearAuthModeForTests, setAuthMode } from '../../src/auth/auth-mode';
import { AGENT_ID_HEADER, runWithHttpCredentialHeaders } from '../../src/auth/credential-context';
import { clearHttpCredentialSourceForTests, setHttpCredentialSource } from '../../src/auth/http-credential-mode';
import {
  MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE,
  resolveSinchOAuthCredentials,
} from '../../src/auth/resolve-sinch-oauth-credentials';
import { SINCH_PROJECT_ID_CLAIM } from '../../src/auth/user-jwt';
import { logger } from '../../src/telemetry/logger';
import { PromptResponse } from '../../src/types';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

jest.mock('../../src/telemetry/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const encodedHeaderCredentials = Buffer.from('header-project:header-key:header-secret').toString('base64');
const authorizationCredentials = `Bearer ${encodedHeaderCredentials}`;
const buildJwt = (projectId: string): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ [SINCH_PROJECT_ID_CLAIM]: projectId })).toString('base64url');
  return `${header}.${payload}.fake-signature`;
};

const agentCredentialsMap = JSON.stringify({
  'order-42:agent-project': {
    accessKeyId: 'agent-key',
    accessKeySecret: 'agent-secret',
  },
});

describe('resolveSinchOAuthCredentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockEnv();
    clearAgentCredentialsCacheForTests();
    clearAuthModeForTests();
    clearHttpCredentialSourceForTests();
  });

  describe('multi-tenant mode (request-header source)', () => {
    beforeEach(() => {
      setHttpCredentialSource('request-header');
      setAuthMode('client-credentials');
    });

    it('resolves a known agent id through the AGENT_CREDENTIALS map', () => {
      setAuthMode('sinchid-agent');
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders(
        {
          [AGENT_ID_HEADER]: 'order-42',
          authorization: `Bearer ${buildJwt('agent-project')}`,
        },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({
        projectId: 'agent-project',
        keyId: 'agent-key',
        keySecret: 'agent-secret',
      });
    });

    it('uses the JWT project when x-agent-id is present', () => {
      setAuthMode('sinchid-agent');
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders(
        {
          [AGENT_ID_HEADER]: 'order-42',
          authorization: `Bearer ${buildJwt('agent-project')}`,
        },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'agent-project' });
    });

    it('fails closed for an unknown agent and project combination', () => {
      setAuthMode('sinchid-agent');
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders(
        {
          [AGENT_ID_HEADER]: 'order-99',
          authorization: `Bearer ${buildJwt('agent-project')}`,
        },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect(logger.warn).toHaveBeenCalledWith(
        { agent_id: 'order-99', project_id: 'agent-project' },
        expect.stringContaining('Unknown agent'),
      );
    });

    it('returns a prompt response naming the unknown agent id', () => {
      setAuthMode('sinchid-agent');
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders(
        {
          [AGENT_ID_HEADER]: 'order-99',
          authorization: `Bearer ${buildJwt('agent-project')}`,
        },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect((resolved as PromptResponse).promptResponse.content[0].text).toContain('order-99');
    });

    it('returns a prompt response when x-agent-id has no JWT project id', () => {
      setAuthMode('sinchid-agent');
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect((resolved as PromptResponse).promptResponse.content[0].text).toContain('Missing project id');
    });

    it('resolves Base64 credentials from Authorization when no agent header is sent', () => {
      const resolved = runWithHttpCredentialHeaders({ authorization: authorizationCredentials }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'header-project' });
    });

    it('returns a prompt response when neither header is sent', () => {
      const resolved = runWithHttpCredentialHeaders({}, () => resolveSinchOAuthCredentials());

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect((resolved as PromptResponse).promptResponse.content[0].text).toBe(
        MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE,
      );
    });

    it('never falls back to server env credentials', () => {
      mockEnv.PROJECT_ID = 'env-project';
      mockEnv.KEY_ID = 'env-key';
      mockEnv.KEY_SECRET = 'env-secret';

      const resolved = runWithHttpCredentialHeaders({}, () => resolveSinchOAuthCredentials());

      expect(resolved).toBeInstanceOf(PromptResponse);
    });
  });

  describe('single-tenant and stdio (env source)', () => {
    it('resolves from the server env', () => {
      mockEnv.PROJECT_ID = 'env-project';
      mockEnv.KEY_ID = 'env-key';
      mockEnv.KEY_SECRET = 'env-secret';

      expect(resolveSinchOAuthCredentials()).toMatchObject({ projectId: 'env-project' });
    });

    it('ignores request Authorization credentials', () => {
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;
      mockEnv.PROJECT_ID = 'env-project';
      mockEnv.KEY_ID = 'env-key';
      mockEnv.KEY_SECRET = 'env-secret';
      setHttpCredentialSource('env');

      const resolved = runWithHttpCredentialHeaders(
        {
          authorization: authorizationCredentials,
        },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'env-project' });
    });

    it('returns a prompt response when env vars are missing', () => {
      expect(resolveSinchOAuthCredentials()).toBeInstanceOf(PromptResponse);
    });
  });
});
