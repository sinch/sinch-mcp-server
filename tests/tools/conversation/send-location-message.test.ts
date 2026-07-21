import { sendLocationMessageHandler } from '../../../src/tools/conversation/send-location-message';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from '../../../src/tools/conversation/utils/conversation-service-helper';
import { buildMessageBase } from '../../../src/tools/conversation/utils/send-message-builder';
import { getLatitudeLongitudeFromAddress } from '../../../src/tools/conversation/utils/geocoding';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper');
jest.mock('../../../src/tools/conversation/utils/send-message-builder', () => ({
  ...jest.requireActual('../../../src/tools/conversation/utils/send-message-builder'),
  buildMessageBase: jest.fn(),
}));
jest.mock('../../../src/tools/conversation/utils/geocoding');

const mockSendLocationMessage = jest.fn();
const mockConversationService = {
  setRegion: jest.fn(),
  messages: {
    sendLocationMessage: mockSendLocationMessage,
  },
};

jest.mocked(getConversationAppId).mockImplementation((id) => id ?? 'mock-app-id');
jest.mocked(getConversationService).mockReturnValue(mockConversationService as any);
jest.mocked(buildMessageBase).mockResolvedValue({ to: 'recipient', from: 'sender', channel: 'SMS' } as any);

beforeEach(() => {
  jest.clearAllMocks();
});

const getLastCallCoordinates = () => {
  const body = jest.mocked(mockSendLocationMessage).mock.calls[0][0].sendMessageRequestBody;
  return body.message.location_message;
};

test('sends location with explicit lat/long coordinates', async () => {
  mockSendLocationMessage.mockResolvedValue({ message_id: 'loc-1' });

  const result = await sendLocationMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    address: { lat: 48.8566, long: 2.3522, title: 'Paris' },
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(result.content[0].text).toEqual(JSON.stringify({ success: true, message_id: 'loc-1' }));
  expect(getLastCallCoordinates()).toEqual({ coordinates: { latitude: 48.8566, longitude: 2.3522 }, title: 'Paris' });
});

test('sends location when lat is 0 (equator)', async () => {
  mockSendLocationMessage.mockResolvedValue({ message_id: 'loc-equator' });

  await sendLocationMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    address: { lat: 0, long: 32.5, title: 'On the equator' },
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(getLastCallCoordinates()).toEqual({ coordinates: { latitude: 0, longitude: 32.5 }, title: 'On the equator' });
});

test('sends location when long is 0 (prime meridian)', async () => {
  mockSendLocationMessage.mockResolvedValue({ message_id: 'loc-meridian' });

  await sendLocationMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    address: { lat: 51.4779, long: 0, title: 'Greenwich' },
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(getLastCallCoordinates()).toEqual({ coordinates: { latitude: 51.4779, longitude: 0 }, title: 'Greenwich' });
});

test('sends location when both lat and long are 0', async () => {
  mockSendLocationMessage.mockResolvedValue({ message_id: 'loc-null-island' });

  await sendLocationMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    address: { lat: 0, long: 0, title: 'Null Island' },
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(getLastCallCoordinates()).toEqual({ coordinates: { latitude: 0, longitude: 0 }, title: 'Null Island' });
});

test('geocodes address when address string is provided', async () => {
  jest.mocked(getLatitudeLongitudeFromAddress).mockResolvedValue({
    latitude: 40.7128,
    longitude: -74.006,
    formattedAddress: 'New York, NY, USA',
  });
  mockSendLocationMessage.mockResolvedValue({ message_id: 'loc-geocoded' });

  const result = await sendLocationMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    address: { address: 'New York' },
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(result.content[0].text).toEqual(JSON.stringify({ success: true, message_id: 'loc-geocoded' }));
  expect(jest.mocked(getLatitudeLongitudeFromAddress)).toHaveBeenCalledWith('New York');
});

test('returns error response on failure', async () => {
  mockSendLocationMessage.mockRejectedValue(new Error('Network error'));
  const region = 'eu';
  jest.mocked(setConversationRegion).mockReturnValue(region);

  const result = await sendLocationMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    address: { lat: 1.0, long: 1.0, title: 'Somewhere' },
    appId: undefined,
    sender: undefined,
    region,
  });

  expect(result.content[0].text).toEqual(
    JSON.stringify({
      success: false,
      error:
        'Network error. If the resource cannot be found, the region parameter may be incorrect. Current region: eu.',
    }),
  );
});
