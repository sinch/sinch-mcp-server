import { setSmsChannelOnAppHandler } from '../../../src/tools/conversation/set-sms-channel-on-app';
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

test('setSmsChannelOnAppHandler merges SMS credentials into the app', async () => {
  mockGet.mockResolvedValue({
    id: 'app-123',
    channel_credentials: [{
      channel: 'MESSENGER',
      static_token: { token: 'fb-token' },
      state: { status: 'ACTIVE' },
      channel_known_id: 'page-1',
    }],
  });
  mockUpdate.mockResolvedValue({
    id: 'app-123',
    channel_credentials: [{ channel: 'SMS', state: { status: 'PENDING' } }],
  });

  const result = await setSmsChannelOnAppHandler({
    appId: 'app-123',
    servicePlanId: 'plan-123',
    apiToken: 'token-abc',
  });

  expect(mockUpdate).toHaveBeenCalledWith({
    app_id: 'app-123',
    appUpdateRequestBody: {
      channel_credentials: [
        {
          channel: 'MESSENGER',
          static_token: { token: 'fb-token' },
        },
        {
          channel: 'SMS',
          static_bearer: {
            claimed_identity: 'plan-123',
            token: 'token-abc',
          },
        },
      ],
    },
  });
  expect(result.content[0].text).toContain('"success":true');
});
