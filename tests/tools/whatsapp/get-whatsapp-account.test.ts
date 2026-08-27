import { getWhatsAppAccountHandler } from '../../../src/tools/whatsapp/get-whatsapp-account';
import { getWhatsAppProvisioningClient } from '../../../src/tools/whatsapp/utils/whatsapp-service-helper';
import {
  WhatsAppApiError,
  WhatsAppProvisioningClient,
} from '../../../src/tools/whatsapp/utils/whatsapp-provisioning-client';
import { PromptResponse } from '../../../src/types';

jest.mock('../../../src/tools/whatsapp/utils/whatsapp-service-helper');

const mockClient = new WhatsAppProvisioningClient('project-id', 'key-id', 'key-secret', 'test-tool');
const mockGetAccount = jest.spyOn(mockClient, 'getAccount');

const mockedGetClient = jest.mocked(getWhatsAppProvisioningClient);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue(mockClient);
});

test('getWhatsAppAccountHandler returns the account as returned by the API', async () => {
  const account = {
    isEmbeddedSignup: true,
    businessManager: 'SINCH_SEP',
    compatibleRegions: ['eu', 'us'],
    state: 'ONBOARDED',
    wabaId: 'waba-123',
    wabaEnabledForInsights: true,
    wabaEnabledForDirectSend: false,
    primaryBusinessLocation: 'FR',
    businessDailyLimit: 'TIER_1K',
    currency: 'EUR',
    details: {
      clientBusinessManagerId: 'bm-456',
      wabaName: 'AcmeCorp',
      senderDetails: {
        displayName: 'AcmeCorp',
        businessCategory: 'SHOPPING_AND_RETAIL',
        region: 'EU',
        metaLocalStorage: 'DE',
      },
    },
  };
  mockGetAccount.mockResolvedValue(account);

  const result = await getWhatsAppAccountHandler();
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeTrue();
  expect(parsed.account).toEqual(account);
});

test('getWhatsAppAccountHandler surfaces a WhatsAppApiError as a formatted failure', async () => {
  mockGetAccount.mockRejectedValue(
    new WhatsAppApiError(404, 'Account not found.', 'account_not_found', 'Verify that the parameters are correct.'),
  );

  const result = await getWhatsAppAccountHandler();
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: false,
    error:
      'HTTP 404: WhatsApp API error (404 Account not found.) errorCode=account_not_found Verify that the parameters are correct.',
  });
});

test('getWhatsAppAccountHandler returns the guard response when credentials are missing', async () => {
  const guard = new PromptResponse(
    JSON.stringify({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' }),
  );
  mockedGetClient.mockReturnValue(guard);

  const result = await getWhatsAppAccountHandler();
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({ success: false, error: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.' });
  expect(mockGetAccount).not.toHaveBeenCalled();
});
