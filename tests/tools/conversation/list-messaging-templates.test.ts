import { Conversation, ConversationService } from '@sinch/conversation';
import { listOmniChannelTemplatesHandler } from '../../../src/tools/conversation/list-messaging-templates';
import {
  getConversationService,
  setTemplateRegion,
} from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationService: jest.fn(),
  setTemplateRegion: jest.fn(() => 'us'),
}));

const mockConversationService = new ConversationService({});
const mockListMessagingTemplates = jest.spyOn(mockConversationService.templatesV2, 'list');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getConversationService).mockReturnValue(mockConversationService);
  jest.mocked(setTemplateRegion).mockReturnValue('us');
});

test('listOmniChannelTemplatesHandler returns the templates for the configured region and mentions the WhatsApp tool', async () => {
  // Given
  mockListMessagingTemplates.mockResolvedValue({
    templates: [
      {
        id: 'template-id',
        description: 'My omni-channel template',
        version: 2,
        default_translation: 'en-US',
        translations: [{ language_code: 'en-US', version: '2' }],
      },
    ],
  } as Conversation.V2ListTemplatesResponse);

  // When
  const result = await listOmniChannelTemplatesHandler();

  // Then
  expect(setTemplateRegion).toHaveBeenCalledTimes(1);
  expect(setTemplateRegion).toHaveBeenCalledWith(undefined, mockConversationService);
  expect(mockListMessagingTemplates).toHaveBeenCalledTimes(1);
  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBeTrue();
  expect(body.region).toBe('us');
  expect(body.templates).toEqual([
    {
      id: 'template-id',
      description: 'My omni-channel template',
      version: 2,
      defaultTranslation: 'en-US',
      translations: ['en-US (version "2")'],
    },
  ]);
  expect(body.total_count).toBe(1);
  expect(body.related_tools['list-whatsapp-templates']).toContain('list-whatsapp-templates');
});

test('listOmniChannelTemplatesHandler surfaces an error with a region hint when the API call fails', async () => {
  // Given
  mockListMessagingTemplates.mockRejectedValue(new Error('Oops'));

  // When
  const result = await listOmniChannelTemplatesHandler();

  // Then
  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBeFalse();
  expect(body.error).toBe(
    'Oops. If the resource cannot be found, the region parameter may be incorrect. Current region: us.',
  );
});
