import { sendChoiceMessageHandler } from '../../../src/tools/conversation/send-choice-message';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from '../../../src/tools/conversation/utils/conversation-service-helper';
import { buildMessageBase } from '../../../src/tools/conversation/utils/send-message-builder';

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

const mockSendChoiceMessage = jest.fn();
const mockConversationService = {
  setRegion: jest.fn(),
  messages: {
    sendChoiceMessage: mockSendChoiceMessage,
  },
};

jest.mocked(getConversationAppId).mockImplementation((id) => id ?? 'mock-app-id');
jest.mocked(getConversationService).mockReturnValue(mockConversationService as any);
jest.mocked(buildMessageBase).mockResolvedValue({ to: 'recipient', from: 'sender', channel: 'SMS' } as any);

beforeEach(() => {
  jest.clearAllMocks();
});

const getLastCallChoices = () => {
  const calls = jest.mocked(mockSendChoiceMessage).mock.calls;
  const body = calls[calls.length - 1][0].sendMessageRequestBody;
  return body.message.choice_message.choices;
};

test('sends location choice when lat is 0 (equator)', async () => {
  mockSendChoiceMessage.mockResolvedValue({ message_id: 'choice-equator' });

  const result = await sendChoiceMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    text: 'Pick a location',
    choiceContent: [{ lat: 0, long: 32.5, title: 'On the equator' }],
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(result.content[0].text).toEqual(JSON.stringify({ success: true, message_id: 'choice-equator' }));
  expect(getLastCallChoices()[0].location_message).toEqual({
    coordinates: { latitude: 0, longitude: 32.5 },
    title: 'On the equator',
  });
});

test('sends location choice when long is 0 (prime meridian)', async () => {
  mockSendChoiceMessage.mockResolvedValue({ message_id: 'choice-meridian' });

  await sendChoiceMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    text: 'Pick a location',
    choiceContent: [{ lat: 51.4779, long: 0, title: 'Greenwich' }],
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(getLastCallChoices()[0].location_message).toEqual({
    coordinates: { latitude: 51.4779, longitude: 0 },
    title: 'Greenwich',
  });
});

test('sends location choice when both lat and long are 0', async () => {
  mockSendChoiceMessage.mockResolvedValue({ message_id: 'choice-null-island' });

  await sendChoiceMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    text: 'Pick a location',
    choiceContent: [{ lat: 0, long: 0, title: 'Null Island' }],
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(getLastCallChoices()[0].location_message).toEqual({
    coordinates: { latitude: 0, longitude: 0 },
    title: 'Null Island',
  });
});

test('returns error response on failure', async () => {
  mockSendChoiceMessage.mockRejectedValue(new Error('Network error'));
  const region = 'eu';
  jest.mocked(setConversationRegion).mockReturnValue(region);

  const result = await sendChoiceMessageHandler({
    recipient: '+123456789',
    channel: ['SMS'],
    text: 'Pick a location',
    choiceContent: [{ lat: 1.0, long: 1.0, title: 'Somewhere' }],
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
