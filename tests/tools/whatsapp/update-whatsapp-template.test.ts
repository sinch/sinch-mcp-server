import { updateWhatsAppTemplateHandler } from '../../../src/tools/whatsapp/update-whatsapp-template';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import {
  WhatsAppApiError,
  WhatsAppProvisioningClient,
} from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockClient = new WhatsAppProvisioningClient('project-id', 'key-id', 'key-secret', 'test-tool');
const mockUpdateTemplate = jest.spyOn(mockClient, 'updateTemplate');

const mockedGetClient = jest.mocked(getWhatsAppProvisioningClient);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue(mockClient);
});

test('updateWhatsAppTemplateHandler sends the built body and returns the template on success', async () => {
  mockUpdateTemplate.mockResolvedValue({
    name: 'order_confirmation',
    language: 'EN',
    category: 'UTILITY',
    analytics: [],
    isMetaGenerated: false,
    state: 'APPROVED',
  });

  const details = {
    components: [{ type: 'BODY' as const, text: 'Your order {{1}} has shipped today.', examples: ['12345'] }],
  };

  const result = await updateWhatsAppTemplateHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
    details,
    status: 'SUBMIT',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(mockUpdateTemplate).toHaveBeenCalledWith('order_confirmation', 'EN', {
    details,
    status: 'SUBMIT',
  });
  expect(parsed).toEqual({
    success: true,
    template: {
      name: 'order_confirmation',
      language: 'EN',
      category: 'UTILITY',
      analytics: [],
      isMetaGenerated: false,
      state: 'APPROVED',
    },
  });
});

test('updateWhatsAppTemplateHandler surfaces a WhatsAppApiError as a formatted failure', async () => {
  mockUpdateTemplate.mockRejectedValue(
    new WhatsAppApiError(
      409,
      'Conflict',
      'template_not_updatable',
      'Updates are only supported by templates with state: APPROVED, DISABLED, PAUSED, REJECTED.',
    ),
  );

  const result = await updateWhatsAppTemplateHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
    status: 'SUBMIT',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error:
      'HTTP 409: WhatsApp API error (409 Conflict) errorCode=template_not_updatable Updates are only supported by templates with state: APPROVED, DISABLED, PAUSED, REJECTED.',
  });
});

test('updateWhatsAppTemplateHandler returns the guard response when credentials are missing', async () => {
  const guard = new PromptResponse(
    JSON.stringify({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' }),
  );
  mockedGetClient.mockReturnValue(guard);

  const result = await updateWhatsAppTemplateHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' });
  expect(mockUpdateTemplate).not.toHaveBeenCalled();
});

test('updateWhatsAppTemplateHandler rejects an update with no fields to change', async () => {
  const result = await updateWhatsAppTemplateHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error: 'No fields provided to update. Specify at least one of: status, category, allowCategoryChange, details.',
  });
  expect(mockUpdateTemplate).not.toHaveBeenCalled();
});

test('updateWhatsAppTemplateHandler updates only the fields provided', async () => {
  mockUpdateTemplate.mockResolvedValue({
    name: 'order_confirmation',
    language: 'EN',
    category: 'MARKETING',
    analytics: [],
    isMetaGenerated: false,
    state: 'DRAFT',
  });

  const result = await updateWhatsAppTemplateHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
    category: 'MARKETING',
    allowCategoryChange: true,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(mockUpdateTemplate).toHaveBeenCalledWith('order_confirmation', 'EN', {
    category: 'MARKETING',
    allowCategoryChange: true,
  });
  expect(parsed).toEqual({
    success: true,
    template: {
      name: 'order_confirmation',
      language: 'EN',
      category: 'MARKETING',
      analytics: [],
      isMetaGenerated: false,
      state: 'DRAFT',
    },
  });
});
