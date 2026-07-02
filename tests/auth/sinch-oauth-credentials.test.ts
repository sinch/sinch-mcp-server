import {
  buildCredentialCacheKey,
  parseSinchCredentialsValue,
  sinchOAuthCredentialsFromEnv,
} from '../../src/auth/sinch-oauth-credentials';
import { resolveSinchOAuthCredentials } from '../../src/auth/resolve-sinch-oauth-credentials';
import { runWithHttpCredentialHeaders } from '../../src/auth/credential-context';
import {
  clearHttpCredentialSourceForTests,
  setHttpCredentialSource,
} from '../../src/auth/http-credential-mode';
import { PromptResponse } from '../../src/types';
import { mockEnv, resetMockEnv } from '../helpers/mock-env';

describe('sinch-oauth-credentials', () => {
  beforeEach(() => {
    resetMockEnv();
    clearHttpCredentialSourceForTests();
  });

  it('parses Base64 projectId:keyId:keySecret', () => {
    const encoded = Buffer.from('proj:key:secret-with:colons').toString('base64');
    const creds = parseSinchCredentialsValue(encoded);

    expect(creds).toMatchObject({
      projectId: 'proj',
      keyId: 'key',
      keySecret: 'secret-with:colons',
    });
    expect(creds!.cacheKey).toEqual(
      buildCredentialCacheKey(creds!.projectId, creds!.keyId, creds!.keySecret),
    );
  });

  it('loads credentials from environment', () => {
    mockEnv.PROJECT_ID = 'p';
    mockEnv.KEY_ID = 'k';
    mockEnv.KEY_SECRET = 's';

    const creds = sinchOAuthCredentialsFromEnv();

    expect(creds).toMatchObject({
      projectId: 'p',
      keyId: 'k',
      keySecret: 's',
    });
    expect(creds!.cacheKey).toEqual(
      buildCredentialCacheKey(creds!.projectId, creds!.keyId, creds!.keySecret),
    );
  });

  it('uses request header in multi-tenant mode', () => {
    setHttpCredentialSource('request-header');

    const encoded = Buffer.from('hdr:hkey:hsecret').toString('base64');
    const resolved = runWithHttpCredentialHeaders(
      { 'x-sinch-credentials': encoded },
      () => resolveSinchOAuthCredentials(),
    );

    expect(resolved).not.toBeInstanceOf(PromptResponse);
    if (resolved instanceof PromptResponse) {
      throw new Error('expected credentials');
    }
    expect(resolved.projectId).toBe('hdr');
  });

  it('uses environment in single-tenant mode even when a header is present', () => {
    setHttpCredentialSource('env');
    mockEnv.PROJECT_ID = 'env-project';
    mockEnv.KEY_ID = 'env-key';
    mockEnv.KEY_SECRET = 'env-secret';

    const encoded = Buffer.from('hdr:hkey:hsecret').toString('base64');
    const resolved = runWithHttpCredentialHeaders(
      { 'x-sinch-credentials': encoded },
      () => resolveSinchOAuthCredentials(),
    );

    expect(resolved).not.toBeInstanceOf(PromptResponse);
    if (resolved instanceof PromptResponse) {
      throw new Error('expected credentials');
    }
    expect(resolved.projectId).toBe('env-project');
  });

  it('returns PromptResponse when credentials are missing', () => {
    const result = resolveSinchOAuthCredentials();
    expect(result).toBeInstanceOf(PromptResponse);
  });
});
