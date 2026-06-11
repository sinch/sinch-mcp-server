import { createConversationAppHandler } from '../../../src/tools/conversation/create-conversation-app';
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

const mockCreate = jest.fn();
const mockConversationService = {
  app: {
    create: mockCreate,
  },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);

beforeEach(() => {
  jest.clearAllMocks();
});

test('createConversationAppHandler creates an app with no channels', async () => {
  mockCreate.mockResolvedValue({
    id: 'app-123',
    display_name: 'My App',
    channel_credentials: [],
  });

  const result = await createConversationAppHandler({
    displayName: 'My App',
  });

  expect(mockCreate).toHaveBeenCalledWith({
    appCreateRequestBody: {
      display_name: 'My App',
      channel_credentials: [],
    },
  });
  expect(result.content[0].text).toContain('"success":true');
  expect(result.content[0].text).toContain('"id":"app-123"');
});
