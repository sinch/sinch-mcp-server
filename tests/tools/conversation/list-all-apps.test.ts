import { listAllAppsHandler } from '../../../src/tools/conversation/list-all-apps';
import {
  getConversationService,
} from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationService: jest.fn(),
  setConversationRegion: jest.fn((region: string, service: any) => {
    service.setRegion(region);
  }),
}));

let currentRegion: string;

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

const mockConversationService = {
  app: {
    list: mockListApps,
  },
  setRegion: setRegionMock,
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);

beforeEach(() => {
  jest.clearAllMocks();
  currentRegion = 'us';
});

test('listAllAppsHandler returns formatted app list for all regions', async () => {
  // Given
  mockListApps.mockImplementation(listMock);

  // When
  const result = await listAllAppsHandler();

  // Then
  expect(setRegionMock).toHaveBeenCalledTimes(3);
  expect(setRegionMock).toHaveBeenCalledWith('us');
  expect(setRegionMock).toHaveBeenCalledWith('eu');
  expect(setRegionMock).toHaveBeenCalledWith('br');

  const expectedResponse = JSON.stringify({
    'apps': [
      {
        'id': 'us1',
        'channel_credentials': [{ 'channel': 'WHATSAPP' }],
        'region': 'us'
      },
      {
        'id': 'br1',
        'channel_credentials': [{ 'channel': 'MESSENGER' }, { 'channel': 'RCS' }],
        'region': 'br',
      }
    ],
    'total_count': 2,
  });

  expect(result.content[0].text).toBe(expectedResponse);
});

test('listAllAppsHandler returns error response on failure', async () => {
  // Given
  mockListApps.mockRejectedValue(new Error('oops'));
  // When
  const result = await listAllAppsHandler();
  // Then
  expect(setRegionMock).toHaveBeenCalledTimes(1);
  expect(setRegionMock).toHaveBeenCalledWith('us');
  const expectedResponse = JSON.stringify({
    success: false,
    error: 'oops'
  });
  expect(result.content[0].text).toBe(expectedResponse);
});
