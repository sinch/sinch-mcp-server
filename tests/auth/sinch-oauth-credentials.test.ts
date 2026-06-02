import {
  buildCredentialCacheKey,
  parseSinchCredentialsValue,
  resolveSinchOAuthCredentials,
  sinchOAuthCredentialsFromEnv,
} from '../../src/auth/sinch-oauth-credentials';
import { runWithHttpCredentialHeaders } from '../../src/auth/credential-context';
import { PromptResponse } from '../../src/types';

describe('sinch-oauth-credentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PROJECT_ID;
    delete process.env.KEY_ID;
    delete process.env.KEY_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses Base64 projectId:keyId:keySecret', () => {
    const encoded = Buffer.from('proj:key:secret-with:colons').toString('base64');
    const creds = parseSinchCredentialsValue(encoded);

    expect(creds).toEqual({
      projectId: 'proj',
      keyId: 'key',
      keySecret: 'secret-with:colons',
      cacheKey: buildCredentialCacheKey('proj', 'key', 'secret-with:colons'),
    });
  });

  it('loads credentials from environment', () => {
    process.env.PROJECT_ID = 'p';
    process.env.KEY_ID = 'k';
    process.env.KEY_SECRET = 's';

    expect(sinchOAuthCredentialsFromEnv()?.projectId).toBe('p');
  });

  it('prefers request credentials over environment', () => {
    process.env.PROJECT_ID = 'env-project';
    process.env.KEY_ID = 'env-key';
    process.env.KEY_SECRET = 'env-secret';

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

  it('returns PromptResponse when credentials are missing', () => {
    const result = resolveSinchOAuthCredentials();
    expect(result).toBeInstanceOf(PromptResponse);
  });
});
