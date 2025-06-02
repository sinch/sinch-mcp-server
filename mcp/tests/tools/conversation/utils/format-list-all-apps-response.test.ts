import { Conversation } from '@sinch/sdk-core';
import { formatListAllAppsResponse } from '../../../../src/tools/conversation/utils/format-list-all-apps-response';

describe('formatListAllAppsResponse', () => {
  it('formats a list of apps with channel credentials', () => {
    const input: Conversation.ListAppsResponse = {
      apps: [
        {
          id: 'app1',
          display_name: 'App One',
          channel_credentials: [
            {
              channel: 'MESSENGER',
              static_token: {
                token: 'zyxwvutsrqponmlkjihgfedcba',
              },
              callback_secret: 'secret1',
              state: {
                status: 'ACTIVE',
                description: ''
              },
              channel_known_id: '12345',
            },
            {
              channel: 'TELEGRAM',
              telegram_credentials: {
                token: 'token2'
              },
              callback_secret: 'secret2',
              state: {
                status: 'ACTIVE',
                description: ''
              },
              channel_known_id: '',
            },
            {
              channel: 'RCS',
              static_bearer: {
                claimed_identity: 'oaSdk5smdGnbdh',
                token: 'abcdef1234567890',
              },
              callback_secret: '',
              state: {
                status: 'FAILING',
                description: ''
              },
              channel_known_id: '',
            }
          ],
          conversation_metadata_report_view: 'NONE',
          rate_limits: {
            outbound: 80,
            inbound: 100,
            webhooks: 100
          }
        },
        {
          id: 'app2',
          display_name: 'App Two',
          channel_credentials: []
        }
      ]
    };

    const output = formatListAllAppsResponse(input);
    expect(output).toEqual({
      apps: [
        {
          id: 'app1',
          display_name: 'App One',
          channel_credentials: [
            { channel: 'MESSENGER' },
            { channel: 'TELEGRAM' }
          ]
        },
        {
          id: 'app2',
          display_name: 'App Two',
          channel_credentials: []
        }
      ]
    });
  });

  it('returns empty apps array when input has no apps', () => {
    const input: Conversation.ListAppsResponse = {};
    const output = formatListAllAppsResponse(input);
    expect(output).toEqual({ apps: [] });
  });

});
