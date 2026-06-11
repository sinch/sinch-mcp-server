import { updateWebhookHandler } from '../../../src/tools/conversation/update-webhook';
import { getConversationService } from '../../../src/tools/conversation/utils/conversation-service-helper';
import { buildDormantTriggersWarning } from '../../../src/tools/conversation/utils/webhook-tools-helper';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationService: jest.fn(),
  setConversationRegion: jest.fn(() => 'us'),
}));

const mockUpdate = jest.fn();
const mockConversationService = {
  webhooks: { update: mockUpdate },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);

beforeEach(() => {
  jest.clearAllMocks();
});

test('updateWebhookHandler rejects empty updates', async () => {
  const result = await updateWebhookHandler({ webhookId: 'wh-1' });

  expect(mockUpdate).not.toHaveBeenCalled();
  expect(JSON.parse(result.content[0].text)).toEqual({
    success: false,
    error: 'At least one of target or triggers must be provided to update a webhook.',
  });
});

test('updateWebhookHandler sends update_mask and warns on empty triggers', async () => {
  mockUpdate.mockResolvedValue({
    id: 'wh-1',
    target: 'https://example.com/hook',
    triggers: [],
  });

  const result = await updateWebhookHandler({
    webhookId: 'wh-1',
    triggers: [],
  });

  expect(mockUpdate).toHaveBeenCalledWith({
    webhook_id: 'wh-1',
    webhookUpdateRequestBody: { triggers: [] },
  });

  const body = JSON.parse(result.content[0].text);
  expect(body.warning).toBe(buildDormantTriggersWarning('wh-1'));
});
