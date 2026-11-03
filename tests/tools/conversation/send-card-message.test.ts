import { z } from 'zod';
import { SendCardMessageSchema, sendCardMessageHandler } from '../../../src/tools/conversation/send-card-message';
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

const mockSendCardMessage = jest.fn();
const mockConversationService = {
  setRegion: jest.fn(),
  messages: {
    sendCardMessage: mockSendCardMessage,
  },
};

jest.mocked(getConversationAppId).mockImplementation((id) => id ?? 'mock-app-id');
jest.mocked(getConversationService).mockReturnValue(mockConversationService as any);
jest.mocked(buildMessageBase).mockResolvedValue({ to: 'recipient', from: 'sender', channel: 'SMS' } as any);

beforeEach(() => {
  jest.clearAllMocks();
});

const getLastCardMessage = () => {
  const calls = jest.mocked(mockSendCardMessage).mock.calls;
  return calls[calls.length - 1][0].sendMessageRequestBody.message.card_message;
};

test('sends a card with the media, the title, the description and the choices', async () => {
  mockSendCardMessage.mockResolvedValue({ message_id: 'card-id' });

  const result = await sendCardMessageHandler({
    recipient: '+123456789',
    channel: ['RCS'],
    title: 'Pick a flavor',
    description: 'We have three of them today',
    mediaUrl: 'https://example.com/flavor.jpg',
    choiceContent: [{ url: 'https://example.com/vanilla', title: 'Vanilla' }],
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(result.content[0].text).toEqual(JSON.stringify({ success: true, message_id: 'card-id' }));
  expect(getLastCardMessage()).toEqual({
    title: 'Pick a flavor',
    description: 'We have three of them today',
    media_message: { url: 'https://example.com/flavor.jpg' },
    choices: [{ url_message: { url: 'https://example.com/vanilla', title: 'Vanilla' } }],
  });
});

describe('card text limits', () => {
  test('rejects a title longer than 200 characters', () => {
    const result = z.object(SendCardMessageSchema).safeParse({
      recipient: '+123456789',
      channel: ['RCS'],
      title: 'a'.repeat(201),
      mediaUrl: 'https://example.com/flavor.jpg',
    });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['title']);
  });

  test('accepts a title of exactly 200 characters', () => {
    const result = z.object(SendCardMessageSchema).safeParse({
      recipient: '+123456789',
      channel: ['RCS'],
      title: 'a'.repeat(200),
      mediaUrl: 'https://example.com/flavor.jpg',
    });

    expect(result.success).toBeTrue();
  });

  test('rejects a description longer than 2000 characters', () => {
    const result = z.object(SendCardMessageSchema).safeParse({
      recipient: '+123456789',
      channel: ['RCS'],
      title: 'Pick a flavor',
      description: 'a'.repeat(2001),
      mediaUrl: 'https://example.com/flavor.jpg',
    });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['description']);
  });
});

test('returns error response on failure', async () => {
  mockSendCardMessage.mockRejectedValue(new Error('Network error'));
  const region = 'eu';
  jest.mocked(setConversationRegion).mockReturnValue(region);

  const result = await sendCardMessageHandler({
    recipient: '+123456789',
    channel: ['RCS'],
    title: 'Pick a flavor',
    description: undefined,
    mediaUrl: 'https://example.com/flavor.jpg',
    choiceContent: undefined,
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
