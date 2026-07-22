import { deleteConversationAppHandler } from '../../../src/tools/conversation/delete-conversation-app';
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

const mockDelete = jest.fn();
const mockConversationService = {
  app: {
    delete: mockDelete,
  },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);

beforeEach(() => {
  jest.clearAllMocks();
});

test('deleteConversationAppHandler deletes an app by ID', async () => {
  mockDelete.mockResolvedValue(undefined);

  const result = await deleteConversationAppHandler({
    appId: 'app-123',
  });

  expect(mockDelete).toHaveBeenCalledWith({
    app_id: 'app-123',
  });
  expect(JSON.parse(result.content[0].text)).toEqual({
    success: true,
    app_id: 'app-123',
  });
});

test('deleteConversationAppHandler returns an error when the API call fails', async () => {
  mockDelete.mockRejectedValue(new Error('App not found'));

  const result = await deleteConversationAppHandler({
    appId: 'missing-app',
  });

  expect(result.content[0].text).toContain('"success":false');
  expect(result.content[0].text).toContain('App not found');
});
