import {
  buildChannelCredential,
  mergeChannelCredentials,
} from '../../../../src/tools/conversation/utils/build-channel-credential';

describe('buildChannelCredential', () => {
  test('builds SMS credentials', () => {
    const credential = buildChannelCredential({
      channel: 'SMS',
      smsServicePlanId: 'plan-123',
      smsApiToken: 'token-abc',
    });

    expect(credential).toEqual({
      channel: 'SMS',
      static_bearer: {
        claimed_identity: 'plan-123',
        token: 'token-abc',
      },
    });
  });

  test('throws when SMS credentials are incomplete', () => {
    expect(() => buildChannelCredential({ channel: 'SMS' })).toThrow(
      'SMS channel requires "smsServicePlanId"'
    );
  });

  test('builds Messenger credentials', () => {
    const credential = buildChannelCredential({
      channel: 'MESSENGER',
      pageAccessToken: 'fb-token',
    });

    expect(credential).toEqual({
      channel: 'MESSENGER',
      static_token: {
        token: 'fb-token',
      },
    });
  });
});

describe('mergeChannelCredentials', () => {
  test('appends a new channel credential', () => {
    const merged = mergeChannelCredentials(
      [{ channel: 'SMS', static_bearer: { claimed_identity: 'plan', token: 'token' }, state: { status: 'ACTIVE' } }],
      { channel: 'RCS', static_bearer: { claimed_identity: 'rcs-id', token: 'rcs-token' } }
    );

    expect(merged).toHaveLength(2);
    expect(merged[1]).toEqual({
      channel: 'RCS',
      static_bearer: { claimed_identity: 'rcs-id', token: 'rcs-token' },
    });
  });

  test('replaces an existing channel credential', () => {
    const merged = mergeChannelCredentials(
      [{ channel: 'SMS', static_bearer: { claimed_identity: 'old', token: 'old-token' }, state: { status: 'ACTIVE' } }],
      { channel: 'SMS', static_bearer: { claimed_identity: 'new', token: 'new-token' } }
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({
      channel: 'SMS',
      static_bearer: {
        claimed_identity: 'new',
        token: 'new-token',
      },
    });
  });
});
