import { addSmsChannelToAppHandler } from '../../../src/tools/conversation/add-sms-channel-to-app';
import { getConversationService } from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
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

test('addSmsChannelToAppHandler merges SMS credentials into the app', async () => {
  mockGet.mockResolvedValue({
    id: 'app-123',
    channel_credentials: [],
  });
  mockUpdate.mockResolvedValue({
    id: 'app-123',
    channel_credentials: [{ channel: 'SMS', state: { status: 'PENDING' } }],
  });

  const result = await addSmsChannelToAppHandler({
    appId: 'app-123',
    servicePlanId: 'plan-123',
    apiToken: 'token-abc',
  });

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
