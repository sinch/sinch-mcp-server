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
    page_count: 1,
    total_count: 7,
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
    countries: ['GB'],
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

test('launchRcsSenderHandler includes checklist hint on 412', async () => {
  mockClient.launchSender.mockRejectedValue(new RcsApiError(412, 'Precondition Failed'));

  const result = await launchRcsSenderHandler({ senderId: 's1' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBeFalse();
  expect(parsed.error).toContain('Launch checklist');
});
