import { setRcsChannelOnAppHandler } from '../../../src/tools/conversation/set-rcs-channel-on-app';
import { getConversationService } from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

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

test('setRcsChannelOnAppHandler merges RCS credentials into the app using senderId and bearerToken as claimed_identity/token', async () => {
  mockGet.mockResolvedValue({
    id: 'app-123',
    channel_credentials: [
      {
        channel: 'MESSENGER',
        static_token: { token: 'fb-token' },
        state: { status: 'ACTIVE' },
        channel_known_id: 'page-1',
      },
    ],
  });
  mockUpdate.mockResolvedValue({
    id: 'app-123',
    channel_credentials: [{ channel: 'RCS', state: { status: 'PENDING' } }],
  });

  // senderId must be the sender's `authName`, and bearerToken must be the sender's `authToken`.
  const result = await setRcsChannelOnAppHandler({
    appId: 'app-123',
    senderId: 'NYrCvmTzGPVwg1zF', // sender's authName
    bearerToken: 'aAGC9yAqcV60UZhcE2Ejr9zd', // sender's authToken
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
          channel: 'RCS',
          static_bearer: {
            claimed_identity: 'NYrCvmTzGPVwg1zF',
            token: 'aAGC9yAqcV60UZhcE2Ejr9zd',
          },
        },
      ],
    },
  });
  expect(result.content[0].text).toContain('"success":true');
});
