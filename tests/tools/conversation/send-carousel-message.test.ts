import { z } from 'zod';
import {
  SendCarouselMessageSchema,
  sendCarouselMessageHandler,
} from '../../../src/tools/conversation/send-carousel-message';
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

const mockSendCarouselMessage = jest.fn();
const mockConversationService = {
  setRegion: jest.fn(),
  messages: {
    sendCarouselMessage: mockSendCarouselMessage,
  },
};

jest.mocked(getConversationAppId).mockImplementation((id) => id ?? 'mock-app-id');
jest.mocked(getConversationService).mockReturnValue(mockConversationService as any);
jest.mocked(buildMessageBase).mockResolvedValue({ to: 'recipient', from: 'sender', channel: 'SMS' } as any);

beforeEach(() => {
  jest.clearAllMocks();
});

const getLastRequestBody = () => jest.mocked(mockSendCarouselMessage).mock.calls[0][0].sendMessageRequestBody;

const minimalCard = {
  title: 'Vanilla',
  mediaUrl: 'https://example.com/vanilla.jpg',
};

const minimalArgs = {
  recipient: '+123456789',
  channel: ['RCS'] as ['RCS'],
  carouselChoices: undefined,
  metadata: undefined,
  appId: undefined,
  sender: undefined,
  region: undefined,
};

test('sends the cards, the per-card choices, the carousel choices and the metadata', async () => {
  mockSendCarouselMessage.mockResolvedValue({ message_id: 'carousel-id' });

  const result = await sendCarouselMessageHandler({
    ...minimalArgs,
    cards: [
      {
        title: 'Vanilla',
        description: 'Made with organic milk',
        mediaUrl: 'https://example.com/vanilla.jpg',
        thumbnailUrl: 'https://example.com/vanilla-thumb.jpg',
        height: 'MEDIUM',
        choiceContent: [{ url: 'https://example.com/order/vanilla', title: 'Order' }],
      },
      {
        title: 'Chocolate',
        description: undefined,
        mediaUrl: 'https://example.com/chocolate.jpg',
        thumbnailUrl: undefined,
        height: undefined,
        choiceContent: undefined,
      },
    ],
    carouselChoices: [{ phone_number: '+34600000000', title: 'Call us' }],
    metadata: 'summer-campaign',
  });

  expect(result.content[0].text).toEqual(JSON.stringify({ success: true, message_id: 'carousel-id' }));
  expect(getLastRequestBody().message_metadata).toEqual('summer-campaign');
  expect(getLastRequestBody().message.carousel_message).toEqual({
    cards: [
      {
        title: 'Vanilla',
        description: 'Made with organic milk',
        height: 'MEDIUM',
        media_message: {
          url: 'https://example.com/vanilla.jpg',
          thumbnail_url: 'https://example.com/vanilla-thumb.jpg',
        },
        choices: [{ url_message: { url: 'https://example.com/order/vanilla', title: 'Order' } }],
      },
      {
        title: 'Chocolate',
        description: undefined,
        height: undefined,
        media_message: {
          url: 'https://example.com/chocolate.jpg',
          thumbnail_url: undefined,
        },
        choices: [],
      },
    ],
    choices: [{ call_message: { phone_number: '+34600000000', title: 'Call us' } }],
  });
});

describe('carousel limits', () => {
  const parse = (args: Record<string, unknown>) =>
    z.object(SendCarouselMessageSchema).safeParse({ recipient: '+123456789', channel: ['RCS'], ...args });

  test('accepts a single card', () => {
    expect(parse({ cards: [minimalCard] }).success).toBeTrue();
  });

  test('rejects an empty list of cards', () => {
    const result = parse({ cards: [] });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['cards']);
  });

  test('rejects more than 10 cards', () => {
    const result = parse({ cards: Array(11).fill(minimalCard) });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['cards']);
  });

  test('rejects more than 4 choices on a card', () => {
    const result = parse({
      cards: [{ ...minimalCard, choiceContent: Array(5).fill({ text: 'Yes' }) }],
    });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['cards', 0, 'choiceContent']);
  });

  test('rejects more than 3 carousel choices', () => {
    const result = parse({ cards: [minimalCard], carouselChoices: Array(4).fill({ text: 'Yes' }) });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['carouselChoices']);
  });

  test('rejects a card title longer than 200 characters', () => {
    const result = parse({ cards: [{ ...minimalCard, title: 'a'.repeat(201) }] });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['cards', 0, 'title']);
  });

  test('rejects a card description longer than 2000 characters', () => {
    const result = parse({ cards: [{ ...minimalCard, description: 'a'.repeat(2001) }] });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['cards', 0, 'description']);
  });

  test.each(['SHORT', 'MEDIUM', 'TALL'] as const)('accepts a %s card height', (height) => {
    const result = parse({ cards: [{ ...minimalCard, height }] });

    expect(result.success).toBeTrue();
  });

  test('rejects metadata longer than 1024 characters', () => {
    const result = parse({ cards: [minimalCard], metadata: 'a'.repeat(1025) });

    expect(result.success).toBeFalse();
    expect(result.error?.issues[0].path).toEqual(['metadata']);
  });
});

test('returns error response on failure', async () => {
  mockSendCarouselMessage.mockRejectedValue(new Error('Network error'));
  const region = 'eu';
  jest.mocked(setConversationRegion).mockReturnValue(region);

  const result = await sendCarouselMessageHandler({
    ...minimalArgs,
    cards: [{ ...minimalCard, description: undefined, thumbnailUrl: undefined, height: undefined, choiceContent: [] }],
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
