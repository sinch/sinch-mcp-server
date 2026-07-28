import { ConversationService } from '@sinch/conversation';
import { listAllTemplatesHandler } from '../../../src/tools/conversation/list-messaging-templates';
import { getConversationService } from '../../../src/tools/conversation/utils/conversation-service-helper';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import { WhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper');
jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockConversationService = new ConversationService({});
const mockListMessagingTemplates = jest.spyOn(mockConversationService.templatesV2, 'list');

const mockWhatsAppClient = new WhatsAppProvisioningClient('project-id', 'key-id', 'key-secret', 'test-tool');
const mockListTemplates = jest.spyOn(mockWhatsAppClient, 'listTemplates');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getConversationService).mockReturnValue(mockConversationService);
  jest.mocked(getWhatsAppProvisioningClient).mockReturnValue(mockWhatsAppClient);
  mockListMessagingTemplates.mockResolvedValue({ templates: [] });
});

test('listAllTemplatesHandler returns WhatsApp templates when credentials resolve', async () => {
  // Given
  mockListTemplates.mockResolvedValue({
    totalSize: 1,
    pageSize: 1,
    templates: [
      {
        name: 'welcome',
        language: 'en',
        category: 'MARKETING',
        state: 'APPROVED',
        analytics: [],
        isMetaGenerated: false,
      },
    ],
  });

  // When
  const result = await listAllTemplatesHandler();

  // Then
  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBeTrue();
  expect(body.templates.whatsapp).toEqual([
    { channel: 'WhatsApp', name: 'welcome', language: 'en', category: 'MARKETING', state: 'APPROVED' },
  ]);
  expect(body.templates.errors).toBeUndefined();
});

test('listAllTemplatesHandler surfaces an error instead of silently reporting no WhatsApp templates when credentials cannot be resolved', async () => {
  // Given
  jest
    .mocked(getWhatsAppProvisioningClient)
    .mockReturnValue(new PromptResponse('Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.'));

  // When
  const result = await listAllTemplatesHandler();

  // Then
  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBeFalse();
  expect(body.templates.whatsapp).toEqual([]);
  expect(body.templates.errors).toEqual([
    { region: 'whatsapp', error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' },
  ]);
});

test('listAllTemplatesHandler surfaces an error when the WhatsApp API call fails', async () => {
  // Given
  mockListTemplates.mockRejectedValue(new Error('Oops'));

  // When
  const result = await listAllTemplatesHandler();

  // Then
  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBeFalse();
  expect(body.templates.whatsapp).toEqual([]);
  expect(body.templates.errors).toEqual([{ region: 'whatsapp', error: 'Oops' }]);
});
