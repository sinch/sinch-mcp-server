import { listAllAppsHandler } from '../../../src/tools/conversation/list-all-apps';
import { getConversationService } from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationService: jest.fn(),
}));

let currentRegion = 'us';

const listMock = jest.fn();
listMock.mockImplementation(() => {
  if (currentRegion === 'us') {
    return Promise.resolve({
      apps: [{
        id: 'us1',
        displayName: 'App US',
        channel_credentials: [
          {channel: 'WHATSAPP', callback_secret: "pa$$word", state: {status: 'ACTIVE'}},
        ]
      }]
    });
  } else if (currentRegion === 'eu') {
    return Promise.resolve({
      apps: []
    });
  } else if (currentRegion === 'br') {
    return Promise.resolve({
      apps: [{
        id: 'br1',
        displayName: 'App BR',
        channel_credentials: [
          {channel: 'MESSENGER', static_token: {token: '{Facebook_Token}'}, state: {status: 'ACTIVE'}},
          {channel: 'RCS', state: {status: 'ACTIVE'}}
        ]
      }]
    });
  }
  return Promise.resolve([]);
});

const setRegionMock = jest.fn((region: string) => {
  currentRegion = region;
});

const mockListApps = jest.fn();

const mockSinchClient = {
  conversation: {
    app: {
      list: mockListApps,
    },
    setRegion: setRegionMock,
  },
};

(getConversationService as jest.Mock).mockReturnValue(mockSinchClient);

test('listAllAppsHandler returns formatted app list for all regions', async () => {
  // Given
  mockListApps.mockImplementation(listMock);

  // When
  const result = await listAllAppsHandler();

  // Then
  expect(setRegionMock).toHaveBeenCalledTimes(2);
  expect(setRegionMock).toHaveBeenCalledWith('eu');
  expect(setRegionMock).toHaveBeenCalledWith('br');

  const expectedText = [
    'List of conversations apps in the US region: {"apps":[{"id":"us1","channel_credentials":[{"channel":"WHATSAPP"}]}]}',
    'List of conversations apps in the EU region: {"apps":[]}',
    'List of conversations apps in the BR region: {"apps":[{"id":"br1","channel_credentials":[{"channel":"MESSENGER"},{"channel":"RCS"}]}]}.',
    'Please return the data in a structured array format with each item on a separate line. Just display the Id, display name, channels and region columns. Example:',
    '| ID   | Display name | Channels       | Region |',
    '| 0123 | My app name  | SMS, MESSENGER | US     |',
  ].join('\n');

  expect(result.content[0].text).toBe(expectedText);
});

test('listAllAppsHandler returns error response on failure', async () => {
  // Given
  mockListApps.mockRejectedValue(new Error('oops'));
  // When
  const result = await listAllAppsHandler();
  // Then
  expect(result.content[0].text).toEqual('Error fetching apps: oops');
});
