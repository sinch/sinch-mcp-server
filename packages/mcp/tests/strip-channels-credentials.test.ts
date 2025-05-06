import { Conversation } from '@sinch/sdk-core';
import { stripChannelsCredentials } from '../src/tools/helpers/strip-channels-credentials';

describe('stripCredentials', () => {

  it('should remove channel credentials from the list Apps response', () => {
    const input: Conversation.ListAppsResponse = {
      apps: [
        {
          id: 'appId1',
          display_name: 'App 1',
          channel_credentials: [
            {
              channel: 'SMS',
              static_bearer: {
                token: 'secret_token_1',
                claimed_identity: 'claimed_identity_1'
              }
            },
            {
              channel: 'MESSENGER',
              static_token: {
                token: 'secret_token_2'
              }
            }
          ]
        },
        {
          id: 'appId2',
          display_name: 'App 2',
          channel_credentials: [
            {
              channel: 'KAKAOTALK',
              kakaotalk_credentials: {
                kakaotalk_sender_key: 'kakaotalk_sender_key_1',
                kakaotalk_plus_friend_id: 'kakaotalk_plus_friend_id_1'
              }
            }
          ]
        }
      ]
    };

    const result = stripChannelsCredentials(input);

    expect(result).toEqual({
      apps: [
        {
          id: 'appId1',
          display_name: 'App 1',
          channel_credentials: [
            {
              channel: 'SMS'
            },
            {
              channel: 'MESSENGER'
            }
          ]
        },
        {
          id: 'appId2',
          display_name: 'App 2',
          channel_credentials: [
            {
              channel: 'KAKAOTALK'
            }
          ]
        }
      ]
    });

  });

});
