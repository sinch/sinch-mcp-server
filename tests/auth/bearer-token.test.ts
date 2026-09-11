import { buildBearerWwwAuthenticateHeader, extractBearerToken } from '../../src/auth/bearer-token';

describe('bearer-token', () => {
  describe('extractBearerToken', () => {
    it('extracts token from Bearer header', () => {
      expect(extractBearerToken('Bearer my-token')).toBe('my-token');
      expect(extractBearerToken('  Bearer my-token')).toBe('my-token');
      expect(extractBearerToken('bearer my-token')).toBe('my-token');
      expect(extractBearerToken('BEARER my-token')).toBe('my-token');
    });

    it('returns undefined for missing or invalid header', () => {
      expect(extractBearerToken(undefined)).toBeUndefined();
      expect(extractBearerToken('Basic abc')).toBeUndefined();
      expect(extractBearerToken('Bearer ')).toBeUndefined();
    });

    it('uses the first valid Bearer token when authorization is an array', () => {
      expect(extractBearerToken(['', 'Bearer my-token'])).toBe('my-token');
      expect(extractBearerToken(['Bearer first', 'Bearer second'])).toBe('first');
    });
  });

  describe('buildBearerWwwAuthenticateHeader', () => {
    it('returns realm-only challenge when authentication is missing', () => {
      expect(buildBearerWwwAuthenticateHeader()).toBe('Bearer realm="sinch-mcp"');
    });

    it('includes RFC 6750 error attributes for invalid tokens', () => {
      expect(
        buildBearerWwwAuthenticateHeader({
          error: 'invalid_token',
          errorDescription: 'The Sinch API credentials are not accepted by this deployment',
        }),
      ).toBe(
        'Bearer realm="sinch-mcp", error="invalid_token", ' +
          'error_description="The Sinch API credentials are not accepted by this deployment"',
      );
    });
  });
});
