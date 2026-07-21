import {
  sendCardOrChoiceMessageHandler,
  choiceMessage,
} from '../../../src/tools/conversation/send-card-or-choice-message';
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
  const body = jest.mocked(mockSendChoiceMessage).mock.calls[0][0].sendMessageRequestBody;
  return body.message.choice_message.choices;
};

describe('choiceMessage schema validation', () => {
  test('accepts location choice with lat: 0', () => {
    expect(choiceMessage.safeParse({ lat: 0, long: 32.5, title: 'On the equator' }).success).toBeTrue();
  });

  test('accepts location choice with long: 0', () => {
    expect(choiceMessage.safeParse({ lat: 51.4779, long: 0, title: 'Greenwich' }).success).toBeTrue();
  });

  test('accepts location choice with both lat and long at 0', () => {
    expect(choiceMessage.safeParse({ lat: 0, long: 0, title: 'Null Island' }).success).toBeTrue();
  });

  test('rejects when no choice type is provided', () => {
    expect(choiceMessage.safeParse({ title: 'No type' }).success).toBeFalse();
  });
});

test('sends location choice when lat is 0 (equator)', async () => {
  mockSendChoiceMessage.mockResolvedValue({ message_id: 'choice-equator' });

  const result = await sendCardOrChoiceMessageHandler({
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

  await sendCardOrChoiceMessageHandler({
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

  await sendCardOrChoiceMessageHandler({
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

  const result = await sendCardOrChoiceMessageHandler({
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
