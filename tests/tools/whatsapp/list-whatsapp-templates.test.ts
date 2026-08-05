import { listWhatsAppTemplatesHandler } from '../../../src/tools/whatsapp/list-whatsapp-templates';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import {
  WhatsAppApiError,
  WhatsAppProvisioningClient,
} from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockClient = new WhatsAppProvisioningClient('project-id', 'key-id', 'key-secret', 'test-tool');
const mockListTemplates = jest.spyOn(mockClient, 'listTemplates');

const mockedGetClient = jest.mocked(getWhatsAppProvisioningClient);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue(mockClient);
});

test('listWhatsAppTemplatesHandler returns the WhatsApp templates and mentions the omni-channel tool', async () => {
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

  const result = await listWhatsAppTemplatesHandler();
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeTrue();
  expect(parsed.templates).toEqual([{ name: 'welcome', language: 'en', category: 'MARKETING', state: 'APPROVED' }]);
  expect(parsed.total_count).toBe(1);
  expect(parsed.related_tools['list-messaging-templates']).toContain('list-messaging-templates');
});

test('listWhatsAppTemplatesHandler surfaces a WhatsAppApiError as a formatted failure', async () => {
  mockListTemplates.mockRejectedValue(
    new WhatsAppApiError(401, 'Unauthorized', 'invalid_credentials', 'Check your credentials.'),
  );

  const result = await listWhatsAppTemplatesHandler();
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'HTTP 401: WhatsApp API error (401 Unauthorized) errorCode=invalid_credentials Check your credentials.',
  });
});

test('listWhatsAppTemplatesHandler returns the guard response when credentials are missing', async () => {
  const guard = new PromptResponse(
    JSON.stringify({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' }),
  );
  mockedGetClient.mockReturnValue(guard);

  const result = await listWhatsAppTemplatesHandler();
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' });
  expect(mockListTemplates).not.toHaveBeenCalled();
});
