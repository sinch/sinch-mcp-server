import { deleteAllWhatsAppTemplateVariantsHandler } from '../../../src/tools/whatsapp/delete-all-whatsapp-template-variants';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import {
  WhatsAppApiError,
  WhatsAppProvisioningClient,
} from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockClient = new WhatsAppProvisioningClient('project-id', 'key-id', 'key-secret', 'test-tool');
const mockDeleteTemplateByName = jest.spyOn(mockClient, 'deleteTemplateByName');

const mockedGetClient = jest.mocked(getWhatsAppProvisioningClient);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue(mockClient);
});

test('deleteAllWhatsAppTemplateVariantsHandler deletes every language variant and returns success', async () => {
  mockDeleteTemplateByName.mockResolvedValue(undefined);

  const result = await deleteAllWhatsAppTemplateVariantsHandler({ templateName: 'order_confirmation' });
  const parsed = JSON.parse(result.content[0].text);

  expect(mockDeleteTemplateByName).toHaveBeenCalledWith('order_confirmation');
  expect(parsed).toEqual({
    success: true,
    templateName: 'order_confirmation',
  });
});

test('deleteAllWhatsAppTemplateVariantsHandler surfaces a WhatsAppApiError as a formatted failure', async () => {
  mockDeleteTemplateByName.mockRejectedValue(
    new WhatsAppApiError(
      429,
      'Too Many Requests',
      'whatsapp_business_api_request_limit_exceeded',
      'WhatsApp business API request limits reached. Please try again later.',
    ),
  );

  const result = await deleteAllWhatsAppTemplateVariantsHandler({ templateName: 'order_confirmation' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error:
      'HTTP 429: WhatsApp API error (429 Too Many Requests) errorCode=whatsapp_business_api_request_limit_exceeded WhatsApp business API request limits reached. Please try again later.',
  });
});

test('deleteAllWhatsAppTemplateVariantsHandler returns the guard response when credentials are missing', async () => {
  const guard = new PromptResponse(
    JSON.stringify({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' }),
  );
  mockedGetClient.mockReturnValue(guard);

  const result = await deleteAllWhatsAppTemplateVariantsHandler({ templateName: 'order_confirmation' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' });
  expect(mockDeleteTemplateByName).not.toHaveBeenCalled();
});
