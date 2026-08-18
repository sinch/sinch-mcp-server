import { clearAgentCredentialsCacheForTests } from '../../src/auth/agent-credentials';
import { AGENT_ID_HEADER, runWithHttpCredentialHeaders } from '../../src/auth/credential-context';
import { clearHttpCredentialSourceForTests, setHttpCredentialSource } from '../../src/auth/http-credential-mode';
import { resolveSinchOAuthCredentials } from '../../src/auth/resolve-sinch-oauth-credentials';
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

const CREDENTIALS_HEADER = 'x-sinch-credentials';
const encodedHeaderCredentials = Buffer.from('header-project:header-key:header-secret').toString('base64');

const agentCredentialsMap = JSON.stringify({
  'order-42': {
    projectId: 'agent-project',
    accessKeyId: 'agent-key',
    accessKeySecret: 'agent-secret',
  },
});

describe('resolveSinchOAuthCredentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockEnv();
    clearAgentCredentialsCacheForTests();
    clearHttpCredentialSourceForTests();
  });

  describe('multi-tenant mode (request-header source)', () => {
    beforeEach(() => {
      setHttpCredentialSource('request-header');
    });

    it('resolves a known agent id through the AGENT_CREDENTIALS map', () => {
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({
        projectId: 'agent-project',
        keyId: 'agent-key',
        keySecret: 'agent-secret',
      });
    });

    it('prefers the agent mapping over the x-sinch-credentials header', () => {
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-42', [CREDENTIALS_HEADER]: encodedHeaderCredentials },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'agent-project' });
    });

    it('falls back to x-sinch-credentials for an unknown agent id, with a warning', () => {
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-99', [CREDENTIALS_HEADER]: encodedHeaderCredentials },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'header-project' });
      expect(logger.warn).toHaveBeenCalledWith({ agent_id: 'order-99' }, expect.stringContaining('Unknown agent id'));
    });

    it('returns a prompt response for an unknown agent id without a fallback header', () => {
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;

      const resolved = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-99' }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect((resolved as PromptResponse).promptResponse.content[0].text).toContain('order-99');
    });

    it('resolves from x-sinch-credentials when no agent header is sent', () => {
      const resolved = runWithHttpCredentialHeaders({ [CREDENTIALS_HEADER]: encodedHeaderCredentials }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'header-project' });
    });

    it('returns a prompt response when neither header is sent', () => {
      const resolved = runWithHttpCredentialHeaders({}, () => resolveSinchOAuthCredentials());

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect((resolved as PromptResponse).promptResponse.content[0].text).toContain(CREDENTIALS_HEADER);
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

    it('ignores the agent header and credentials header', () => {
      mockEnv.AGENT_CREDENTIALS = agentCredentialsMap;
      mockEnv.PROJECT_ID = 'env-project';
      mockEnv.KEY_ID = 'env-key';
      mockEnv.KEY_SECRET = 'env-secret';
      setHttpCredentialSource('env');

      const resolved = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-42', [CREDENTIALS_HEADER]: encodedHeaderCredentials },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toMatchObject({ projectId: 'env-project' });
    });

    it('returns a prompt response when env vars are missing', () => {
      expect(resolveSinchOAuthCredentials()).toBeInstanceOf(PromptResponse);
    });
  });
});
