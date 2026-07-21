import { createWhatsAppTemplateHandler } from '../../../src/tools/whatsapp/create-whatsapp-template';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import { WhatsAppApiError } from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockClient = {
  createTemplate: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getWhatsAppProvisioningClient as jest.Mock).mockReturnValue(mockClient);
});

test('createWhatsAppTemplateHandler sends the built body and returns the template on success', async () => {
  mockClient.createTemplate.mockResolvedValue({
    name: 'order_confirmation',
    language: 'EN',
    category: 'UTILITY',
    analytics: [],
    isMetaGenerated: false,
  });

  const details = {
    components: [{ type: 'BODY' as const, text: 'Your order {{1}} has shipped.', examples: ['12345'] }],
  };

  const result = await createWhatsAppTemplateHandler({
    name: 'order_confirmation',
    language: 'EN',
    category: 'UTILITY',
    details,
    status: 'SUBMIT',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(mockClient.createTemplate).toHaveBeenCalledWith({
    name: 'order_confirmation',
    language: 'EN',
    category: 'UTILITY',
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
    },
  });
});

test('createWhatsAppTemplateHandler surfaces a WhatsAppApiError as a formatted failure', async () => {
  mockClient.createTemplate.mockRejectedValue(
    new WhatsAppApiError(409, 'Conflict', 'template_exists', 'Templates must have unique name and language.'),
  );

  const result = await createWhatsAppTemplateHandler({
    name: 'order_confirmation',
    language: 'EN',
    category: 'UTILITY',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error:
      'HTTP 409: WhatsApp API error (409 Conflict) errorCode=template_exists Templates must have unique name and language.',
  });
});

test('createWhatsAppTemplateHandler returns the guard response when credentials are missing', async () => {
  const guard = new PromptResponse(
    JSON.stringify({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' }),
  );
  (getWhatsAppProvisioningClient as jest.Mock).mockReturnValue(guard);

  const result = await createWhatsAppTemplateHandler({
    name: 'order_confirmation',
    language: 'EN',
    category: 'UTILITY',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' });
  expect(mockClient.createTemplate).not.toHaveBeenCalled();
});
