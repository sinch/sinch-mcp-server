import { ApiFetchClient } from '@sinch/sdk-client';
import { ConversationService } from '@sinch/conversation';
import {
  getConversationService,
  getConversationAppId,
  setConversationRegion,
  setTemplateRegion,
} from '../../../../src/tools/conversation/utils/conversation-service-helper';
import { PromptResponse } from '../../../../src/types';
import { formatUserAgent } from '../../../../src/utils';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

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
    const service = getConversationService(TOOL_NAME) as ConversationService;
    const expectedHostname = 'https://us.conversation.api.sinch.com';
    const conversationFetchClient = service.lazyConversationClient.apiFetchClient;

    expect(conversationFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(conversationFetchClient!.apiClientOptions.hostname).toBe(expectedHostname);
    expect(conversationFetchClient!.apiClientOptions.requestPlugins?.length).toBe(2);

    const userAgentPlugin = conversationFetchClient!.apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });

  test('returns a configured ConversationService from getConversationTemplateService', async () => {
    const service = getConversationService(TOOL_NAME) as ConversationService;
    const expectedHostname = 'https://us.template.api.sinch.com';
    const templateFetchClient = service.lazyConversationTemplateClient.apiFetchClient;

    expect(templateFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(templateFetchClient!.apiClientOptions.hostname).toBe(expectedHostname);
    expect(templateFetchClient!.apiClientOptions.requestPlugins?.length).toBe(2);

    const userAgentPlugin = templateFetchClient!.apiClientOptions.requestPlugins?.find((plugin) => plugin.getName() === 'AdditionalHeadersRequest');
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });

  test('setConversationRegion updates hostname to the given non-default region', () => {
    const service = getConversationService(TOOL_NAME) as ConversationService;
    setConversationRegion('eu', service);

    expect(service.lazyConversationClient.apiFetchClient!.apiClientOptions.hostname)
      .toBe('https://eu.conversation.api.sinch.com');
  });

  test('setTemplateRegion updates hostname to the given non-default region', () => {
    const service = getConversationService(TOOL_NAME) as ConversationService;
    setTemplateRegion('eu', service);

    expect(service.lazyConversationTemplateClient.apiFetchClient!.apiClientOptions.hostname)
      .toBe('https://eu.template.api.sinch.com');
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
