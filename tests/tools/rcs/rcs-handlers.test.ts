import { getRcsSenderHandler } from '../../../src/tools/rcs/get-rcs-sender';
import { listRcsSendersHandler } from '../../../src/tools/rcs/list-rcs-senders';
import { launchRcsSenderHandler } from '../../../src/tools/rcs/launch-rcs-sender';
import { createRcsSenderHandler } from '../../../src/tools/rcs/create-rcs-sender';
import { updateRcsSenderHandler } from '../../../src/tools/rcs/update-rcs-sender';
import { getRcsProvisioningClient } from '../../../src/tools/rcs/utils/rcs-service-helper';
import { RcsApiError } from '../../../src/tools/rcs/utils/rcs-provisioning-client';

jest.mock('../../../src/tools/rcs/utils/rcs-service-helper');

const mockClient = {
  listSenders: jest.fn(),
  getSender: jest.fn(),
  createSender: jest.fn(),
  updateSender: jest.fn(),
  launchSender: jest.fn(),
};

(getRcsProvisioningClient as jest.Mock).mockReturnValue(mockClient);

beforeEach(() => {
  jest.clearAllMocks();
});

test('listRcsSendersHandler returns summarized senders', async () => {
  mockClient.listSenders.mockResolvedValue({
    senders: [
      {
        id: 's1',
        region: 'EU',
        billingCategory: 'NON_CONVERSATIONAL',
        useCase: 'OTP',
        state: 'DRAFT',
        authToken: 'secret',
      },
    ],
    nextPageToken: 'next',
    totalSize: 7,
  });

  const result = await listRcsSendersHandler({});
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed).toEqual({
    success: true,
    senders: [
      {
        id: 's1',
        state: 'DRAFT',
        region: 'EU',
        billingCategory: 'NON_CONVERSATIONAL',
        useCase: 'OTP',
        created: undefined,
        modified: undefined,
        launched: undefined,
      },
    ],
    nextPageToken: 'next',
    pageCount: 1,
    totalCount: 7,
  });
  expect(parsed.senders[0]).not.toHaveProperty('authToken');
});

test('getRcsSenderHandler returns full sender with credentials', async () => {
  mockClient.getSender.mockResolvedValue({
    id: 's1',
    region: 'US',
    billingCategory: 'CONVERSATIONAL',
    useCase: 'PROMOTIONAL',
    authName: 'name',
    authToken: 'token',
  });

  const result = await getRcsSenderHandler({ senderId: 's1' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeTrue();
  expect(parsed.sender.authName).toBe('name');
  expect(parsed.sender.authToken).toBe('token');
});

test('createRcsSenderHandler sends full details in one call', async () => {
  mockClient.createSender.mockResolvedValue({
    id: 'new',
    region: 'EU',
    billingCategory: 'NON_CONVERSATIONAL',
    useCase: 'TRANSACTIONAL',
    state: 'DRAFT',
  });

  const details = {
    brand: { name: 'Acme', logoUrl: 'https://example.com/logo.png' },
    countries: ['GB' as const],
  };

  await createRcsSenderHandler({
    region: 'EU',
    billingCategory: 'NON_CONVERSATIONAL',
    useCase: 'TRANSACTIONAL',
    details,
  });

  expect(mockClient.createSender).toHaveBeenCalledWith({
    region: 'EU',
    billingCategory: 'NON_CONVERSATIONAL',
    useCase: 'TRANSACTIONAL',
    details,
  });
});

test('updateRcsSenderHandler rejects empty body', async () => {
  const result = await updateRcsSenderHandler({ senderId: 's1' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeFalse();
  expect(mockClient.updateSender).not.toHaveBeenCalled();
});

test('launchRcsSenderHandler returns the missing requirements (not the HTTP status) on a precondition failure', async () => {
  mockClient.launchSender.mockRejectedValue(new RcsApiError(412, 'Precondition Failed'));
  mockClient.getSender.mockResolvedValue({
    id: 's1',
    region: 'EU',
    billingCategory: 'NON_CONVERSATIONAL',
    useCase: 'TRANSACTIONAL',
    state: 'DRAFT',
    details: { brand: { name: 'Acme' } },
  });

  const result = await launchRcsSenderHandler({ senderId: 's1' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeFalse();
  expect(mockClient.getSender).toHaveBeenCalledWith('s1');
  expect(parsed.error).toBe(
    'The sender is not ready to launch: some required details are still missing. ' +
      'Fill the items in missingRequirements via update-rcs-sender, then retry the launch.',
  );
  expect(parsed.missingRequirements).toEqual([
    'details.brand.logoUrl (JPEG/PNG, max 50 KB, 224×224 px)',
    'details.brand.bannerUrl (JPEG/PNG, max 200 KB, 1440×448 px)',
    'details.brand.privacyPolicyUrl',
    'details.brand.termsOfServiceUrl',
    'at least one of details.brand.phones or details.brand.emails',
    'at least one entry in details.countries',
    'details.questionnaire.general.answers',
    'details.questionnaire.verification.answers',
  ]);
  expect(parsed.sender).toMatchObject({ id: 's1', state: 'DRAFT' });
});
