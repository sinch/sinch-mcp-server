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
