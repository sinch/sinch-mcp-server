import {
  formatListWebhooksResponse,
  formatWebhook,
} from '../../../../src/tools/conversation/utils/format-webhook-response';

describe('formatWebhook', () => {
  it('omits secret and client_credentials from webhook payloads', () => {
    const formatted = formatWebhook({
      id: 'wh-1',
      app_id: 'app-1',
      target: 'https://example.com/hook',
      target_type: 'HTTP',
      triggers: ['MESSAGE_INBOUND'],
      secret: 'signing-secret',
      client_credentials: {
        client_id: 'id',
        client_secret: 'shh',
        endpoint: 'https://auth.example.com/token',
      },
    });

    expect(formatted).toEqual({
      id: 'wh-1',
      app_id: 'app-1',
      target: 'https://example.com/hook',
      target_type: 'HTTP',
      triggers: ['MESSAGE_INBOUND'],
    });
    expect(formatted).not.toHaveProperty('secret');
    expect(formatted).not.toHaveProperty('client_credentials');
  });
});

describe('formatListWebhooksResponse', () => {
  it('returns empty list when response is undefined', () => {
    expect(formatListWebhooksResponse(undefined)).toEqual({ webhooks: [] });
  });

  it('formats each webhook without secrets', () => {
    const formatted = formatListWebhooksResponse({
      webhooks: [
        {
          id: 'wh-1',
          app_id: 'app-123',
          target: 'https://example.com/a',
          secret: 'hidden',
        },
      ],
    });

    expect(formatted.webhooks).toEqual([
      {
        id: 'wh-1',
        app_id: 'app-123',
        target: 'https://example.com/a',
        target_type: undefined,
        triggers: undefined,
      },
    ]);
  });
});
