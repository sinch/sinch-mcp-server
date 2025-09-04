import { sendTextMessageHandler } from '../../../src/tools/conversation/send-text-message';
import { getConversationAppId, getConversationRegion, getConversationClient } from '../../../src/tools/conversation/utils/conversation-service-helper';
import { buildMessageBase } from '../../../src/tools/conversation/utils/send-message-builder';

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper');
jest.mock('../../../src/tools/conversation/utils/send-message-builder');

const mockSendTextMessage = jest.fn();
const mockSinchClient = {
  conversation: {
    setRegion: jest.fn(),
    messages: {
      sendTextMessage: mockSendTextMessage,
    },
  },
};

(getConversationAppId as jest.Mock).mockImplementation((id) => id ?? 'mock-app-id');
(getConversationClient as jest.Mock).mockReturnValue(mockSinchClient);
(getConversationRegion as jest.Mock).mockImplementation((region) => region ?? 'us');
(buildMessageBase as jest.Mock).mockResolvedValue({ to: 'recipient', from: 'sender', channel: 'WHATSAPP' });

beforeEach(() => {
  jest.clearAllMocks();
});

test('sendTextMessageHandler returns success response', async () => {
  mockSendTextMessage.mockResolvedValue({ message_id: 'abc123' });

  const result = await sendTextMessageHandler({
    message: 'Hello!',
    recipient: '+123456789',
    channel: ['WHATSAPP'],
    appId: undefined,
    sender: undefined,
    region: undefined,
  });

  expect(result.content[0].text).toEqual('Text message submitted on channel WHATSAPP! The message ID is abc123');
});

test('sendTextMessageHandler returns error response on failure', async () => {
  mockSendTextMessage.mockRejectedValue(new Error('oops'));

  const result = await sendTextMessageHandler({
    message: 'Hi',
    recipient: '+123456789',
    channel: ['RCS'],
    appId: 'my-app-id',
    sender: 'sender-id',
    region: 'eu',
  });

  expect(result.content[0].text).toEqual('An error occurred when trying to send the text message: {}. Are you sure you are using the right region to send your message? The current region is eu.');
});
