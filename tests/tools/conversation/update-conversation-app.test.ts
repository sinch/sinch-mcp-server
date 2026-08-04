import { updateConversationAppHandler } from '../../../src/tools/conversation/update-conversation-app';
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

const mockUpdate = jest.fn();
const mockConversationService = {
  app: {
    update: mockUpdate,
  },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);

beforeEach(() => {
  jest.clearAllMocks();
});

test('updateConversationAppHandler updates the app display name', async () => {
  mockUpdate.mockResolvedValue({
    id: 'app-123',
    display_name: 'Renamed App',
    channel_credentials: [],
  });

  const result = await updateConversationAppHandler({
    appId: 'app-123',
    displayName: 'Renamed App',
  });

  expect(mockUpdate).toHaveBeenCalledWith({
    app_id: 'app-123',
    appUpdateRequestBody: {
      display_name: 'Renamed App',
    },
  });
  expect(result.content[0].text).toContain('"success":true');
  expect(result.content[0].text).toContain('"display_name":"Renamed App"');
});

test('updateConversationAppHandler returns an error when the API call fails', async () => {
  mockUpdate.mockRejectedValue(new Error('App not found'));

  const result = await updateConversationAppHandler({
    appId: 'missing-app',
    displayName: 'New Name',
  });

  expect(result.content[0].text).toContain('"success":false');
  expect(result.content[0].text).toContain('App not found');
});
