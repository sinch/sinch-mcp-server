import {
  buildRcsChannelCredential,
  buildSmsChannelCredential,
  buildWhatsAppChannelCredential,
  mergeChannelCredentials,
  toChannelCredentialRequest,
} from '../../../../src/tools/conversation/utils/build-channel-credential';

describe('buildSmsChannelCredential', () => {
  test('builds SMS static bearer credentials', () => {
    expect(buildSmsChannelCredential('plan-123', 'token-abc')).toEqual({
      channel: 'SMS',
      static_bearer: {
        claimed_identity: 'plan-123',
        token: 'token-abc',
      },
    });
  });
});

describe('buildRcsChannelCredential', () => {
  test('builds RCS static bearer credentials', () => {
    expect(buildRcsChannelCredential('rcs-sender', 'rcs-token')).toEqual({
      channel: 'RCS',
      static_bearer: {
        claimed_identity: 'rcs-sender',
        token: 'rcs-token',
      },
    });
  });
});

describe('buildWhatsAppChannelCredential', () => {
  test('builds WhatsApp static bearer credentials', () => {
    expect(buildWhatsAppChannelCredential('wa-sender', 'wa-token')).toEqual({
      channel: 'WHATSAPP',
      static_bearer: {
        claimed_identity: 'wa-sender',
        token: 'wa-token',
      },
    });
  });
});

describe('toChannelCredentialRequest', () => {
  test('omits response-only fields from PATCH payload', () => {
    expect(
      toChannelCredentialRequest({
        channel: 'SMS',
        static_bearer: { claimed_identity: 'plan', token: 'secret' },
        state: { status: 'ACTIVE' },
        channel_known_id: 'known-id',
      }),
    ).toEqual({
      channel: 'SMS',
      static_bearer: {
        claimed_identity: 'plan',
        token: 'secret',
      },
    });
  });
});

describe('mergeChannelCredentials', () => {
  test('replaces one channel credential and preserves the other channels', () => {
    const existing = [
      {
        channel: 'SMS' as const,
        static_bearer: { claimed_identity: 'old-plan', token: 'old-token' },
        state: { status: 'ACTIVE' as const },
      },
      {
        channel: 'RCS' as const,
        static_bearer: { claimed_identity: 'rcs-sender', token: 'rcs-token' },
        state: { status: 'ACTIVE' as const },
      },
    ];

    const incoming = {
      channel: 'SMS' as const,
      static_bearer: {
        claimed_identity: 'new-plan',
        token: 'new-token',
      },
    };

    const merged = mergeChannelCredentials(existing, incoming);

    expect(merged).toEqual([
      {
        channel: 'SMS',
        static_bearer: {
          claimed_identity: 'new-plan',
          token: 'new-token',
        },
      },
      {
        channel: 'RCS',
        static_bearer: {
          claimed_identity: 'rcs-sender',
          token: 'rcs-token',
        },
      },
    ]);
  });
});
