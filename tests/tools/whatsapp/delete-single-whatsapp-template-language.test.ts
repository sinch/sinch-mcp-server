import { deleteSingleWhatsAppTemplateLanguageHandler } from '../../../src/tools/whatsapp/delete-single-whatsapp-template-language';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import {
  WhatsAppApiError,
  WhatsAppProvisioningClient,
} from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockClient = new WhatsAppProvisioningClient('project-id', 'key-id', 'key-secret', 'test-tool');
const mockDeleteTemplate = jest.spyOn(mockClient, 'deleteTemplate');

const mockedGetClient = jest.mocked(getWhatsAppProvisioningClient);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue(mockClient);
});

test('deleteSingleWhatsAppTemplateLanguageHandler deletes the template and returns success', async () => {
  mockDeleteTemplate.mockResolvedValue(undefined);

  const result = await deleteSingleWhatsAppTemplateLanguageHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
    deleteSubmitted: true,
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(mockDeleteTemplate).toHaveBeenCalledWith('order_confirmation', 'EN', true);
  expect(parsed).toEqual({
    success: true,
    templateName: 'order_confirmation',
    languageCode: 'EN',
  });
});

test('deleteSingleWhatsAppTemplateLanguageHandler surfaces a WhatsAppApiError as a formatted failure', async () => {
  mockDeleteTemplate.mockRejectedValue(
    new WhatsAppApiError(
      409,
      'Conflict',
      'template_not_deletable_due_to_input_config',
      'Only draft templates will be deleted by name and language code if deleteSubmitted is false or not provided.',
    ),
  );

  const result = await deleteSingleWhatsAppTemplateLanguageHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error:
      'HTTP 409: WhatsApp API error (409 Conflict) errorCode=template_not_deletable_due_to_input_config Only draft templates will be deleted by name and language code if deleteSubmitted is false or not provided.',
  });
});

test('deleteSingleWhatsAppTemplateLanguageHandler returns the guard response when credentials are missing', async () => {
  const guard = new PromptResponse(
    JSON.stringify({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' }),
  );
  mockedGetClient.mockReturnValue(guard);

  const result = await deleteSingleWhatsAppTemplateLanguageHandler({
    templateName: 'order_confirmation',
    languageCode: 'EN',
  });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' });
  expect(mockDeleteTemplate).not.toHaveBeenCalled();
});
