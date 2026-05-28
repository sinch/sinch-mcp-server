import { listWebhooksHandler } from '../../../src/tools/conversation/list-webhooks';
import {
  getConversationAppId,
  getConversationService,
} from '../../../src/tools/conversation/utils/conversation-service-helper';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('../../../src/tools/conversation/utils/conversation-service-helper', () => ({
  getConversationService: jest.fn(),
  getConversationAppId: jest.fn(),
  setConversationRegion: jest.fn(() => 'us'),
}));

const mockList = jest.fn();
const mockConversationService = {
  webhooks: { list: mockList },
};

(getConversationService as jest.Mock).mockReturnValue(mockConversationService);
(getConversationAppId as jest.Mock).mockReturnValue('app-123');

beforeEach(() => {
  jest.clearAllMocks();
});

test('listWebhooksHandler returns formatted webhooks without secrets', async () => {
  mockList.mockResolvedValue({
    webhooks: [{
      id: 'wh-1',
      app_id: 'app-123',
      target: 'https://example.com/hook',
      triggers: ['MESSAGE_INBOUND'],
      secret: 'must-not-appear',
    }],
  });

  const result = await listWebhooksHandler({});

  expect(mockList).toHaveBeenCalledWith({ app_id: 'app-123' });
  expect(JSON.parse(result.content[0].text)).toEqual({
    success: true,
    webhooks: [{
      id: 'wh-1',
      app_id: 'app-123',
      target: 'https://example.com/hook',
      target_type: undefined,
      triggers: ['MESSAGE_INBOUND'],
    }],
    total_count: 1,
  });
});

test('listWebhooksHandler includes region hint on failure', async () => {
  mockList.mockRejectedValue(new Error('Not found'));

  const result = await listWebhooksHandler({ region: 'eu' });

  const body = JSON.parse(result.content[0].text);
  expect(body.success).toBe(false);
  expect(body.error).toContain('Current region: us.');
  expect(body.error).toContain('region parameter may be incorrect');
  expect(body.error).toContain('Other regions to try:');
});
