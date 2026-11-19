import {
  getSinchAuthUrl,
  getSinchConversationTemplatesUrl,
  getSinchConversationUrl,
  getSinchNumberLookupUrl,
  getSinchNumbersUrl,
  getSinchProvisioningUrl,
  getSinchVerificationUrl,
  getSinchVoiceUrl,
} from '../src/sinch-api-hosts';
import { sinchApiUrlSchema } from '../src/sinch-api-url-schema';
import { mockEnv, resetMockEnv } from './helpers/mock-env';

describe('sinch-api-hosts', () => {
  beforeEach(() => {
    resetMockEnv();
  });

  it('defaults every API to its production host', () => {
    expect(getSinchAuthUrl()).toBe('https://auth.sinch.com');
    expect(getSinchConversationUrl()).toBe('https://{region}conversation.api.sinch.com');
    expect(getSinchConversationTemplatesUrl()).toBe('https://{region}template.api.sinch.com');
    expect(getSinchNumbersUrl()).toBe('https://numbers.api.sinch.com');
    expect(getSinchVoiceUrl()).toBe('https://voice.api.sinch.com');
    expect(getSinchNumberLookupUrl()).toBe('https://lookup.api.sinch.com');
    expect(getSinchVerificationUrl()).toBe('https://verification.api.sinch.com');
    expect(getSinchProvisioningUrl()).toBe('https://provisioning.api.sinch.com');
  });

  it('uses the SINCH_*_URL overrides when set', () => {
    mockEnv.SINCH_AUTH_URL = 'https://auth.example.test';
    mockEnv.SINCH_CONVERSATION_URL = 'https://{region}conversation.example.test';
    mockEnv.SINCH_TEMPLATES_URL = 'https://{region}template.example.test';
    mockEnv.SINCH_NUMBERS_URL = 'https://numbers.example.test';
    mockEnv.SINCH_VOICE_URL = 'https://voice.example.test';
    mockEnv.SINCH_NUMBER_LOOKUP_URL = 'https://lookup.example.test';
    mockEnv.SINCH_VERIFICATION_URL = 'https://verification.example.test';
    mockEnv.SINCH_PROVISIONING_URL = 'https://provisioning.example.test';

    expect(getSinchAuthUrl()).toBe('https://auth.example.test');
    expect(getSinchConversationUrl()).toBe('https://{region}conversation.example.test');
    expect(getSinchConversationTemplatesUrl()).toBe('https://{region}template.example.test');
    expect(getSinchNumbersUrl()).toBe('https://numbers.example.test');
    expect(getSinchVoiceUrl()).toBe('https://voice.example.test');
    expect(getSinchNumberLookupUrl()).toBe('https://lookup.example.test');
    expect(getSinchVerificationUrl()).toBe('https://verification.example.test');
    expect(getSinchProvisioningUrl()).toBe('https://provisioning.example.test');
  });
});

describe('SINCH_*_URL schemas', () => {
  it.each(['https://auth.sinch.com', 'https://auth.example.test:8443', 'http://localhost:3000'])(
    'accepts the host %s',
    (url) => {
      expect(sinchApiUrlSchema.safeParse(url).success).toBeTrue();
    },
  );

  it.each([
    ['a path', 'https://auth.example.test/oauth2/token'],
    ['a trailing slash', 'https://auth.example.test/'],
    ['no scheme', 'auth.example.test'],
    ['whitespace', 'https://auth.example.test '],
  ])('rejects a host with %s', (_description, url) => {
    expect(sinchApiUrlSchema.safeParse(url).success).toBeFalse();
  });

  it('accepts a conversation host with or without the {region} placeholder', () => {
    expect(sinchApiUrlSchema.safeParse('https://{region}conversation.example.test').success).toBeTrue();
    expect(sinchApiUrlSchema.safeParse('https://api.eu1tst.conversation-api.staging.sinch.com').success).toBeTrue();
  });
});
