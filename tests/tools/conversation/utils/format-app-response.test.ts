import { formatAppResponse } from '../../../../src/tools/conversation/utils/format-app-response';

test('formatAppResponse includes claimed_identity for static bearer channels', () => {
  const formatted = formatAppResponse({
    id: 'app-1',
    display_name: 'Test',
    channel_credentials: [{
      channel: 'SMS',
      static_bearer: {
        claimed_identity: 'plan-123',
        token: 'secret',
      },
      state: { status: 'ACTIVE' },
    }],
  });

  expect(formatted.channel_credentials).toEqual([{
    channel: 'SMS',
    status: 'ACTIVE',
    claimed_identity: 'plan-123',
  }]);
});

test('formatAppResponse omits channel_known_id when undefined', () => {
  const formatted = formatAppResponse({
    id: 'app-1',
    channel_credentials: [{
      channel: 'RCS',
      static_bearer: {
        claimed_identity: 'sender-1',
        token: 'secret',
      },
      state: { status: 'PENDING' },
    }],
  });

  expect(formatted.channel_credentials?.[0]).not.toHaveProperty('channel_known_id');
});

test('formatAppResponse includes channel_known_id when defined', () => {
  const formatted = formatAppResponse({
    id: 'app-1',
    channel_credentials: [{
      channel: 'SMS',
      channel_known_id: 'page-123',
      static_bearer: {
        claimed_identity: 'plan-123',
        token: 'secret',
      },
      state: { status: 'ACTIVE' },
    }],
  });

  expect(formatted.channel_credentials).toEqual([{
    channel: 'SMS',
    status: 'ACTIVE',
    channel_known_id: 'page-123',
    claimed_identity: 'plan-123',
  }]);
});
