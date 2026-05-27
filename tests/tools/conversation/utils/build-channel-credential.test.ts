import {
  buildRcsChannelCredential,
  buildSmsChannelCredential,
  buildWhatsAppChannelCredential,
  mergeChannelCredentials,
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

describe('mergeChannelCredentials', () => {
  test('replaces an existing channel credential', () => {
    const merged = mergeChannelCredentials(
      [{ channel: 'SMS', static_bearer: { claimed_identity: 'old', token: 'old-token' }, state: { status: 'ACTIVE' } }],
      buildSmsChannelCredential('new', 'new-token'),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(buildSmsChannelCredential('new', 'new-token'));
  });
});
