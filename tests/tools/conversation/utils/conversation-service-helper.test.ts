import { ApiFetchClient } from '@sinch/sdk-client';
import { ConversationService } from '@sinch/conversation';
import {
  getConversationService,
  getConversationTemplateService,
  getConversationAppId,
} from '../../../../src/tools/conversation/utils/conversation-service-helper';
import { PromptResponse } from '../../../../src/types';
import { formatUserAgent } from '../../../../src/utils';

const mockApi = () => ({
  setHostname: jest.fn(),
});

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

jest.mock('@sinch/conversation', () => {
  const actual = jest.requireActual('@sinch/conversation');
  return {
    ...actual,
    ConversationService: jest.fn(() => ({
      app: mockApi(),
      contact: mockApi(),
      conversation: mockApi(),
      messages: mockApi(),
      events: mockApi(),
      capability: mockApi(),
      transcoding: mockApi(),
      webhooks: mockApi(),
      templatesV2: mockApi(),
    })),
  }
});

describe('getConversationService / getConversationTemplateService', () => {
  const OLD_ENV = process.env;
  const PROJECT_ID = 'test-project';
  const TOOL_NAME = 'dummy-tool';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.PROJECT_ID = PROJECT_ID;
    process.env.KEY_ID = 'test-key-id';
    process.env.KEY_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns a configured ConversationService from getConversationService', async () => {
    const service = getConversationService(TOOL_NAME);
    expect(service).toHaveProperty('app');
    expect(service).toHaveProperty('contact');
    expect(service).toHaveProperty('conversation');
    expect(service).toHaveProperty('messages');
    expect(service).toHaveProperty('events');
    expect(service).toHaveProperty('capability');
    expect(service).toHaveProperty('transcoding');
    expect(service).toHaveProperty('webhooks');
    expect(service).toHaveProperty('templatesV2');

    const apis = service as ConversationService;
    const expectedHostname = 'https://us.conversation.api.sinch.com';

    for (const [key, api] of Object.entries(apis)) {
      if (key !== 'templatesV2') {
        expect(api.setHostname).toHaveBeenCalledWith(expectedHostname);
        expect(api.client).toBeInstanceOf(ApiFetchClient);
        const userAgentPlugin = (api.client as ApiFetchClient).apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
        expect(userAgentPlugin).toBeDefined();
        const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
        expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
      }
    }

  });

  test('returns a configured ConversationService from getConversationTemplateService', async () => {
    const service = getConversationTemplateService(TOOL_NAME);
    expect(service).toHaveProperty('conversation');

    const api = (service as ConversationService).templatesV2;
    const expectedHostname = 'https://us.template.api.sinch.com';

    expect(api.setHostname).toHaveBeenCalledWith(expectedHostname);
    expect(api.client).toBeInstanceOf(ApiFetchClient);
    expect(api.client!.apiClientOptions.requestPlugins?.length).toBe(2);
    const userAgentPlugin = (api.client as ApiFetchClient).apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });

  test('returns PromptResponse when env vars are missing', () => {
    delete process.env.PROJECT_ID;
    const result = getConversationService(TOOL_NAME);
    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse).toStrictEqual({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
        }
      ]
    });
  });
});

describe('getConversationAppId', () => {
  test('returns appId when passed explicitly', () => {
    const result = getConversationAppId('explicit-id');
    expect(result).toBe('explicit-id');
  });

  test('returns appId from env when not passed', () => {
    process.env.CONVERSATION_APP_ID = 'env-id';
    const result = getConversationAppId(undefined);
    expect(result).toBe('env-id');
  });

  test('returns PromptResponse when no appId is provided or in env', () => {
    delete process.env.CONVERSATION_APP_ID;
    const result = getConversationAppId(undefined);
    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse).toStrictEqual({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'The "CONVERSATION_APP_ID" is not set in the environment variables and the "appId" property is not provided.',
        }
      ]
    });
  });
});
