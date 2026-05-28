import { createWebhookHandler } from '../../../src/tools/conversation/create-webhook';
import {
  getConversationAppId,
  getConversationService,
} from '../../../src/tools/conversation/utils/conversation-service-helper';
import { buildDormantTriggersWarning } from '../../../src/tools/conversation/utils/webhook-tools-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationService: jest.fn(),
  getConversationAppId: jest.fn(),
  setConversationRegion: jest.fn(() => 'us'),
}));

const mockCreate = jest.fn();
const mockConversationService = {
  webhooks: { create: mockCreate },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);
(getConversationAppId as jest.Mock).mockReturnValue('app-123');

beforeEach(() => {
  jest.clearAllMocks();
});

test('createWebhookHandler creates HTTP webhook and omits secret from response', async () => {
  mockCreate.mockResolvedValue({
    id: 'wh-new',
    app_id: 'app-123',
    target: 'https://example.com/hook',
    target_type: 'HTTP',
    triggers: ['MESSAGE_INBOUND'],
    secret: 'generated-secret',
  });

  const result = await createWebhookHandler({
    target: 'https://example.com/hook',
    triggers: ['MESSAGE_INBOUND'],
  });

  expect(mockCreate).toHaveBeenCalledWith({
    webhookCreateRequestBody: {
      app_id: 'app-123',
      target: 'https://example.com/hook',
      target_type: 'HTTP',
      triggers: ['MESSAGE_INBOUND'],
    },
  });

  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBe(true);
  expect(body.webhook).not.toHaveProperty('secret');
  expect(body.warning).toBeUndefined();
});

test('createWebhookHandler warns when no triggers are provided', async () => {
  mockCreate.mockResolvedValue({
    id: 'wh-new',
    app_id: 'app-123',
    target: 'https://example.com/hook',
    target_type: 'HTTP',
  });

  const result = await createWebhookHandler({
    target: 'https://example.com/hook',
  });

  const body = JSON.parse(result.content[0].text);
  expect(body.warning).toBe(buildDormantTriggersWarning('wh-new'));
});
