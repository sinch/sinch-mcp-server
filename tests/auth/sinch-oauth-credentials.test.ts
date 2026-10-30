import {
  buildAgentM2MSecretId,
  parseSinchCredentialsAuthorizationHeader,
  parseSinchCredentialsValue,
  sinchOAuthCredentialsFromEnv,
} from '../../src/auth/sinch-oauth-credentials';
import { resolveSinchOAuthCredentials } from '../../src/auth/resolve-sinch-oauth-credentials';
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
    it('returns PromptResponse when credentials are missing', () => {
      const result = resolveSinchOAuthCredentials();
      expect(expectPromptText(result)).toBe('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.');
    });
  });
});
