import { configureConversationAppChannelHandler } from '../../../src/tools/conversation/configure-conversation-app-channel';
import {
  getConversationAppId,
  getConversationService,
} from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationAppId: jest.fn((id?: string) => id ?? 'env-app-id'),
  getConversationService: jest.fn(),
  setConversationRegion: jest.fn(() => 'us'),
}));

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockConversationService = {
  app: {
    get: mockGet,
    update: mockUpdate,
  },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);

beforeEach(() => {
  jest.clearAllMocks();
});

test('configureConversationAppChannelHandler merges and updates channel credentials', async () => {
  mockGet.mockResolvedValue({
    id: 'app-123',
    display_name: 'My App',
    channel_credentials: [],
  });
  mockUpdate.mockResolvedValue({
    id: 'app-123',
    display_name: 'My App',
    channel_credentials: [{
      channel: 'SMS',
      state: { status: 'PENDING' },
    }],
  });

  const result = await configureConversationAppChannelHandler({
    appId: 'app-123',
    channel: 'SMS',
    smsServicePlanId: 'plan-123',
    smsApiToken: 'token-abc',
  });

  expect(mockGet).toHaveBeenCalledWith({ app_id: 'app-123' });
  expect(mockUpdate).toHaveBeenCalledWith({
    app_id: 'app-123',
    update_mask: ['channel_credentials'],
    appUpdateRequestBody: {
      channel_credentials: [{
        channel: 'SMS',
        static_bearer: {
          claimed_identity: 'plan-123',
          token: 'token-abc',
        },
      }],
    },
  });
  expect(result.content[0].text).toContain('"success":true');
});

test('configureConversationAppChannelHandler returns missing app id error', async () => {
  (getConversationAppId as jest.Mock).mockReturnValueOnce({
    promptResponse: {
      content: [{ type: 'text', text: 'missing app id' }],
    },
  });

  const result = await configureConversationAppChannelHandler({
    channel: 'SMS',
    smsServicePlanId: 'plan-123',
    smsApiToken: 'token-abc',
  });

  expect(result.content[0].text).toBe('missing app id');
  expect(mockGet).not.toHaveBeenCalled();
});
