import {
  buildMessageBase,
  ChannelNotConfiguredError,
} from '../../../../src/tools/conversation/utils/send-message-builder';
import { Conversation } from '@sinch/conversation';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

const mockGetApp = jest.fn();

const mockConversationService = {
  app: {
    get: mockGetApp,
  },
};

const baseAppConfig = {
  channel_credentials: [{ channel: 'WHATSAPP' }, { channel: 'SMS' }],
} as Conversation.AppResponse;

beforeEach(() => {
  jest.clearAllMocks();
  resetMockEnv();
  mockEnv.DEFAULT_SMS_ORIGINATOR = '+12014444333';
});

test('buildMessageBase sets correct base structure and adds SMS fallback when needed', async () => {
  mockGetApp.mockResolvedValue(baseAppConfig);

  const result = await buildMessageBase(mockConversationService as any, 'my-app-id', '+1234567890', ['WHATSAPP']);

  expect(result).toMatchObject({
    app_id: 'my-app-id',
    processing_strategy: 'DISPATCH_ONLY',
    channel_properties: {
      SMS_SENDER: '+12014444333',
    },
    recipient: {
      identified_by: {
        channel_identities: [
          { channel: 'WHATSAPP', identity: '+1234567890' },
          { channel: 'SMS', identity: '+1234567890' }, // fallback
        ],
      },
    },
  });
});

test('MMS fallback switches to SMS when MMS is not configured', async () => {
  mockGetApp.mockResolvedValue({ channel_credentials: [] });

  const result = await buildMessageBase(mockConversationService as any, 'my-app-id', '+1234567890', ['MMS']);

  expect(result.recipient.identified_by.channel_identities[0].channel).toBe('SMS');
});

test('throws ChannelNotConfiguredError when a requested channel is not configured on the app', async () => {
  mockGetApp.mockResolvedValue({ channel_credentials: [{ channel: 'SMS' }] });

  await expect(buildMessageBase(mockConversationService as any, 'my-app-id', '+1234567890', ['RCS'])).rejects.toThrow(
    new ChannelNotConfiguredError(['RCS'], ['SMS']),
  );
});

test('does not throw when at least one requested channel is configured (RCS+SMS, only SMS configured)', async () => {
  mockGetApp.mockResolvedValue({ channel_credentials: [{ channel: 'SMS' }] });

  const result = await buildMessageBase(mockConversationService as any, 'my-app-id', '+1234567890', ['RCS', 'SMS']);

  const channels = result.recipient.identified_by.channel_identities.map((ci) => ci.channel);
  expect(channels).toEqual(['SMS']);
});

test('No SMS fallback is added if already included', async () => {
  mockGetApp.mockResolvedValue(baseAppConfig);

  const result = await buildMessageBase(mockConversationService as any, 'my-app-id', '+1234567890', [
    'WHATSAPP',
    'SMS',
  ]);

  const channels = result.recipient.identified_by.channel_identities.map((ci) => ci.channel);
  const smsCount = channels.filter((c) => c === 'SMS').length;

  expect(smsCount).toBe(1); // only once
});

test('Does not set channel_properties if sender is undefined and env var is missing', async () => {
  mockEnv.DEFAULT_SMS_ORIGINATOR = undefined;
  mockGetApp.mockResolvedValue(baseAppConfig);

  const result = await buildMessageBase(mockConversationService as any, 'my-app-id', '+1234567890', ['SMS']);

  expect(result.channel_properties).toBeUndefined();
});
