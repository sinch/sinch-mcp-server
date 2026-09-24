import {
  buildAgentM2MSecretId,
  parseSinchCredentialsAuthorizationHeader,
  parseSinchCredentialsValue,
  sinchOAuthCredentialsFromEnv,
} from '../../src/auth/sinch-oauth-credentials';
import {
  MISSING_AGENT_CREDENTIALS_MESSAGE,
  MISSING_AGENT_INSTALLATION_MESSAGE,
  MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE,
  resolveSinchOAuthCredentials,
} from '../../src/auth/resolve-sinch-oauth-credentials';
import { AGENT_ID_HEADER, runWithHttpCredentialHeaders } from '../../src/auth/credential-context';
import { clearAuthModeForTests, setAuthMode } from '../../src/auth/auth-mode';
import { clearHttpCredentialSourceForTests, setHttpCredentialSource } from '../../src/auth/http-credential-mode';
import { PromptResponse } from '../../src/types';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

const encodeCredentials = (value: string): string => Buffer.from(value).toString('base64');
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

const expectPromptText = (result: unknown): string => {
  expect(result).toBeInstanceOf(PromptResponse);
  return (result as PromptResponse).promptResponse.content[0].text;
};

describe('sinch-oauth-credentials', () => {
  beforeEach(() => {
    resetMockEnv();
    clearHttpCredentialSourceForTests();
    clearAuthModeForTests();
  });

  describe('parseSinchCredentialsValue', () => {
    it('parses Base64 projectId:keyId:keySecret', () => {
      const creds = parseSinchCredentialsValue(encodeCredentials('proj:key:secret-with:colons'));

      expect(creds).toEqual({
        projectId: 'proj',
        keyId: 'key',
        keySecret: 'secret-with:colons',
        cacheKey: '94a2565d5b7f23bc2b6eab6a5c6a5ef49b780630b72e597677ef614779b04ba3',
      });
    });

    it('tolerates surrounding whitespace and missing padding', () => {
      const padded = encodeCredentials('proj:key:secret');
      expect(parseSinchCredentialsValue(`  ${padded}  `)?.projectId).toBe('proj');
      expect(parseSinchCredentialsValue(padded.replace(/=+$/, ''))?.keySecret).toBe('secret');
    });

    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['not Base64', 'not base64!!'],
      ['a JWT-shaped token', 'aaa.bbb.ccc'],
      ['a base64url alphabet token', 'cHJvag-6a2V5_OnNlY3JldA'],
      ['no separators', encodeCredentials('projkeysecret')],
      ['a single separator', encodeCredentials('proj:key')],
      ['an empty projectId', encodeCredentials(':key:secret')],
      ['an empty keyId', encodeCredentials('proj::secret')],
      ['an empty keySecret', encodeCredentials('proj:key:')],
    ])('returns undefined for %s', (_label, value) => {
      expect(parseSinchCredentialsValue(value)).toBeUndefined();
    });
  });

  describe('parseSinchCredentialsAuthorizationHeader', () => {
    const encoded = encodeCredentials('proj:key:secret');

    it('parses credentials from a Bearer token', () => {
      expect(parseSinchCredentialsAuthorizationHeader(`Bearer ${encoded}`)?.projectId).toBe('proj');
      expect(parseSinchCredentialsAuthorizationHeader(`bearer ${encoded}`)?.projectId).toBe('proj');
    });

    it('uses the first Bearer value when the header is repeated', () => {
      expect(parseSinchCredentialsAuthorizationHeader(['', `Bearer ${encoded}`])?.projectId).toBe('proj');
    });

    it.each([
      ['a missing header', undefined],
      ['an empty header', ''],
      ['a bare token without scheme', encoded],
      ['a non-Bearer scheme', `Basic ${encoded}`],
      ['an empty Bearer token', 'Bearer '],
      ['an opaque token such as an MCP API key', 'Bearer my-static-api-key'],
      ['a Bearer JWT', 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature'],
      ['a Bearer token that decodes without separators', `Bearer ${encodeCredentials('projkeysecret')}`],
    ])('returns undefined for %s', (_label, header) => {
      expect(parseSinchCredentialsAuthorizationHeader(header)).toBeUndefined();
    });
  });

  describe('buildAgentM2MSecretId', () => {
    it('builds a canonical Secret Manager ID from UUID orderId and projectId', () => {
      expect(buildAgentM2MSecretId(ORDER_ID.toUpperCase(), PROJECT_ID.toUpperCase())).toBe(
        `sinch-agent-m2m_${ORDER_ID}_${PROJECT_ID}`,
      );
    });

    it.each([
      ['a non-UUID orderId', 'order-42', PROJECT_ID],
      ['a non-UUID projectId', ORDER_ID, 'project-1'],
      ['a UUID with a missing group', '11111111-1111-1111-111111111111', PROJECT_ID],
      ['a UUID containing a non-hex character', ORDER_ID, '22222222-2222-4222-8222-22222222222g'],
    ])('rejects %s', (_label, orderId, projectId) => {
      expect(buildAgentM2MSecretId(orderId, projectId)).toBeUndefined();
    });
  });

  it('loads credentials from environment', () => {
    mockEnv.PROJECT_ID = 'p';
    mockEnv.KEY_ID = 'k';
    mockEnv.KEY_SECRET = 's';

    const creds = sinchOAuthCredentialsFromEnv();

    expect(creds).toEqual({
      projectId: 'p',
      keyId: 'k',
      keySecret: 's',
      cacheKey: '18aceb6e19d3c1c0b54100a374b7458f3abf2426c8b78645fb8b7175039231a7',
    });
  });

  describe('resolveSinchOAuthCredentials', () => {
    const encoded = encodeCredentials('hdr:hkey:hsecret');

    it('uses the Authorization Bearer credentials in multi-tenant mode', () => {
      setHttpCredentialSource('request-header');

      const resolved = runWithHttpCredentialHeaders({ authorization: `Bearer ${encoded}` }, undefined, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).not.toBeInstanceOf(PromptResponse);
      if (resolved instanceof PromptResponse) {
        throw new Error('expected credentials');
      }
      expect(resolved.projectId).toBe('hdr');
    });

    it('does not read credentials from unrelated headers in multi-tenant mode', () => {
      setHttpCredentialSource('request-header');

      const resolved = runWithHttpCredentialHeaders({ 'other-header': encoded }, undefined, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(expectPromptText(resolved)).toBe(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
    });

    it('ignores unrelated headers even when Authorization also carries credentials', () => {
      setHttpCredentialSource('request-header');

      const resolved = runWithHttpCredentialHeaders(
        {
          authorization: `Bearer ${encoded}`,
          'other-header': encodeCredentials('other:lkey:lsecret'),
        },
        undefined,
        () => resolveSinchOAuthCredentials(),
      );

      if (resolved instanceof PromptResponse) {
        throw new Error('expected credentials');
      }
      expect(resolved.projectId).toBe('hdr');
    });

    it('returns a PromptResponse naming Authorization when the header is missing in multi-tenant mode', () => {
      setHttpCredentialSource('request-header');

      const resolved = runWithHttpCredentialHeaders({}, undefined, () => resolveSinchOAuthCredentials());

      const text = expectPromptText(resolved);
      expect(text).toBe(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
      expect(text).toContain('Authorization');
      expect(text.toLowerCase()).not.toContain('other-header');
    });

    it.each([
      ['a non-Bearer scheme', `Basic ${encoded}`],
      ['an empty Bearer token', 'Bearer '],
      ['a non-Base64 Bearer token', 'Bearer not-base64!!'],
      ['a Bearer token missing the key secret', `Bearer ${encodeCredentials('hdr:hkey')}`],
      ['a Bearer user JWT', 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature'],
    ])('returns a PromptResponse naming Authorization for %s in multi-tenant mode', (_label, header) => {
      setHttpCredentialSource('request-header');

      const resolved = runWithHttpCredentialHeaders({ authorization: header }, undefined, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(expectPromptText(resolved)).toBe(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
    });

    it('uses environment in single-tenant mode even when Authorization carries credentials', () => {
      setHttpCredentialSource('env');
      mockEnv.PROJECT_ID = 'env-project';
      mockEnv.KEY_ID = 'env-key';
      mockEnv.KEY_SECRET = 'env-secret';

      const resolved = runWithHttpCredentialHeaders({ authorization: `Bearer ${encoded}` }, undefined, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).not.toBeInstanceOf(PromptResponse);
      if (resolved instanceof PromptResponse) {
        throw new Error('expected credentials');
      }
      expect(resolved.projectId).toBe('env-project');
    });

    it('returns PromptResponse when credentials are missing', () => {
      const result = resolveSinchOAuthCredentials();
      expect(expectPromptText(result)).toBe('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
    });
  });

  describe('sinchid-agent mode', () => {
    const promptText = (response: PromptResponse): string => response.promptResponse.content[0].text;
    const agentCredentials = parseSinchCredentialsValue(encodeCredentials('project-1:agent-key:agent-secret'));
    if (!agentCredentials) {
      throw new Error('expected valid agent credentials');
    }

    it('points the caller at the agent installation when neither orderId nor projectId is present', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('sinchid-agent');

      const resolved = runWithHttpCredentialHeaders({}, undefined, () => resolveSinchOAuthCredentials());

      expect(resolved).toBeInstanceOf(PromptResponse);
      const text = promptText(resolved as PromptResponse);
      expect(text).toBe(MISSING_AGENT_INSTALLATION_MESSAGE);
      expect(text).toContain('agent installation');
      expect(text).toContain('x-agent-id');
      expect(text).not.toContain('Authorization');
    });

    it('points the caller at the agent installation when user claims are missing projectId', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('sinchid-agent');

      const resolved = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-42' },
        { email: 'user@example.com' },
        () => resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect(promptText(resolved as PromptResponse)).toBe(MISSING_AGENT_INSTALLATION_MESSAGE);
    });

    it('points the caller at the agent installation when x-agent-id header is missing', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('sinchid-agent');

      const resolved = runWithHttpCredentialHeaders({}, { projectId: 'project-1' }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect(promptText(resolved as PromptResponse)).toBe(MISSING_AGENT_INSTALLATION_MESSAGE);
    });

    it('fails closed when no credentials are configured for the installation', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('sinchid-agent');

      const resolved = runWithHttpCredentialHeaders({ [AGENT_ID_HEADER]: 'order-42' }, { projectId: 'project-1' }, () =>
        resolveSinchOAuthCredentials(),
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect(promptText(resolved as PromptResponse)).toBe(MISSING_AGENT_CREDENTIALS_MESSAGE);
    });

    it('resolves credentials loaded for the orderId and verified projectId', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('sinchid-agent');

      const resolved = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-42' },
        { projectId: 'project-1' },
        () => resolveSinchOAuthCredentials(),
        agentCredentials,
      );

      if (resolved instanceof PromptResponse) {
        throw new Error('expected credentials');
      }
      expect(resolved.projectId).toBe('project-1');
    });

    it('fails closed when the configured credential belongs to another project', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('sinchid-agent');
      const otherProjectCredentials = parseSinchCredentialsValue(
        encodeCredentials('other-project:agent-key:agent-secret'),
      );

      const resolved = runWithHttpCredentialHeaders(
        { [AGENT_ID_HEADER]: 'order-42' },
        { projectId: 'project-1' },
        () => resolveSinchOAuthCredentials(),
        otherProjectCredentials,
      );

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect(promptText(resolved as PromptResponse)).toBe(MISSING_AGENT_CREDENTIALS_MESSAGE);
    });

    it('still points client-credentials callers at the Authorization header', () => {
      setHttpCredentialSource('request-header');
      setAuthMode('client-credentials');

      const resolved = runWithHttpCredentialHeaders({}, undefined, () => resolveSinchOAuthCredentials());

      expect(resolved).toBeInstanceOf(PromptResponse);
      expect(promptText(resolved as PromptResponse)).toBe(MISSING_AUTHORIZATION_CREDENTIALS_MESSAGE);
    });
  });
});
