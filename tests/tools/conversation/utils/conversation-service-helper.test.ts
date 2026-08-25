import { ApiFetchClient, SupportedConversationRegion } from '@sinch/sdk-client';
import { ConversationService } from '@sinch/conversation';
import {
  getConversationService,
  getConversationAppId,
  resolveConversationRegionsToList,
  setConversationRegion,
  setTemplateRegion,
} from '../../../../src/tools/conversation/utils/conversation-service-helper';
import { PromptResponse } from '../../../../src/types';
import { formatUserAgent } from '../../../../src/utils';
import {
  clearHttpCredentialSourceForTests,
  getHttpCredentialSource,
  setHttpCredentialSource,
} from '../../../../src/auth/http-credential-mode';
import { mockEnv, resetMockEnv } from '../../../helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

describe('getConversationService / getConversationTemplateService', () => {
  const PROJECT_ID = 'test-project';
  const TOOL_NAME = 'dummy-tool';

  beforeEach(() => {
    resetMockEnv();
    mockEnv.PROJECT_ID = PROJECT_ID;
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
  });

  test('returns a configured ConversationService from getConversationService', async () => {
    const service = getConversationService(TOOL_NAME) as ConversationService;
    const expectedHostname = 'https://us.conversation.api.sinch.com';
    const conversationFetchClient = service.lazyConversationClient.apiFetchClient;

    expect(conversationFetchClient).toBeInstanceOf(ApiFetchClient);
    expect(conversationFetchClient!.apiClientOptions.hostname).toBe(expectedHostname);
    expect(conversationFetchClient!.apiClientOptions.requestPlugins?.length).toBe(2);

    const userAgentPlugin = conversationFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin.getName() === 'AdditionalHeadersRequest',
    );
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

    const userAgentPlugin = templateFetchClient!.apiClientOptions.requestPlugins?.find(
      (plugin) => plugin.getName() === 'AdditionalHeadersRequest',
    );
    expect(userAgentPlugin).toBeDefined();
    const expectedUserAgent = formatUserAgent(TOOL_NAME, PROJECT_ID);
    expect((await (userAgentPlugin as any).additionalHeaders.headers)['User-Agent']).toBe(expectedUserAgent);
  });

  test('setConversationRegion updates hostname to the given non-default region', () => {
    const service = getConversationService(TOOL_NAME) as ConversationService;
    setConversationRegion('eu', service);

    expect(service.lazyConversationClient.apiFetchClient!.apiClientOptions.hostname).toBe(
      'https://eu.conversation.api.sinch.com',
    );
  });

  test('setTemplateRegion updates hostname to the given non-default region', () => {
    const service = getConversationService(TOOL_NAME) as ConversationService;
    setTemplateRegion('eu', service);

    expect(service.lazyConversationTemplateClient.apiFetchClient!.apiClientOptions.hostname).toBe(
      'https://eu.template.api.sinch.com',
    );
  });

  test('resolveConversationRegionsToList returns every supported region', () => {
    expect(resolveConversationRegionsToList()).toEqual(Object.values(SupportedConversationRegion));
  });

  test('returns PromptResponse when env vars are missing', () => {
    mockEnv.PROJECT_ID = undefined;
    const result = getConversationService(TOOL_NAME);
    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse.content[0].text).toContain(
      'Missing env vars: PROJECT_ID, KEY_ID, KEY_SECRET.',
    );
  });
});

describe('region resolution in multi-tenant mode', () => {
  const TOOL_NAME = 'dummy-tool';

  let service: ConversationService;

  beforeEach(() => {
    resetMockEnv();
    mockEnv.PROJECT_ID = 'test-project';
    mockEnv.KEY_ID = 'test-key-id';
    mockEnv.KEY_SECRET = 'test-secret';
    // Build the service before switching to multi-tenant, as credentials
    // come from request headers (not env) in that mode.
    service = getConversationService(TOOL_NAME) as ConversationService;
    setHttpCredentialSource('request-header');
  });

  afterEach(() => {
    clearHttpCredentialSourceForTests();
  });

  test('setConversationRegion ignores the prompt region and uses the env region', () => {
    mockEnv.CONVERSATION_REGION = 'br';
    const usedRegion = setConversationRegion('eu', service);

    // The prompt region ("eu") is discarded because the server runs in multi-tenant mode
    expect(getHttpCredentialSource()).toBe('request-header');
    expect(usedRegion).toBe('br');
    expect(service.lazyConversationClient.apiFetchClient!.apiClientOptions.hostname).toBe(
      'https://br.conversation.api.sinch.com',
    );
  });

  test('setTemplateRegion ignores the prompt region and uses the env region', () => {
    mockEnv.CONVERSATION_REGION = 'br';
    const usedRegion = setTemplateRegion('eu', service);

    // The prompt region ("eu") is discarded because the server runs in multi-tenant mode
    expect(getHttpCredentialSource()).toBe('request-header');
    expect(usedRegion).toBe('br');
    expect(service.lazyConversationTemplateClient.apiFetchClient!.apiClientOptions.hostname).toBe(
      'https://br.template.api.sinch.com',
    );
  });

  test('resolveConversationRegionsToList returns only the pinned region', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    expect(resolveConversationRegionsToList()).toEqual(['eu']);
  });

  test('resolveConversationRegionsToList throws when CONVERSATION_REGION is not set', () => {
    mockEnv.CONVERSATION_REGION = undefined;
    expect(() => resolveConversationRegionsToList()).toThrow(
      'CONVERSATION_REGION must be set in multi-tenant mode; no default region is applied.',
    );
  });

  test('setConversationRegion throws instead of defaulting when CONVERSATION_REGION is not set', () => {
    mockEnv.CONVERSATION_REGION = undefined;
    expect(() => setConversationRegion('eu', service)).toThrow(
      'CONVERSATION_REGION must be set in multi-tenant mode; no default region is applied.',
    );
  });

  test('setTemplateRegion throws instead of defaulting when CONVERSATION_REGION is not set', () => {
    mockEnv.CONVERSATION_REGION = undefined;
    expect(() => setTemplateRegion('eu', service)).toThrow(
      'CONVERSATION_REGION must be set in multi-tenant mode; no default region is applied.',
    );
  });
});

describe('getConversationAppId', () => {
  beforeEach(() => {
    resetMockEnv();
  });

  test('returns appId when passed explicitly', () => {
    const result = getConversationAppId('explicit-id');
    expect(result).toBe('explicit-id');
  });

  test('returns appId from env when not passed', () => {
    mockEnv.CONVERSATION_APP_ID = 'env-id';
    const result = getConversationAppId(undefined);
    expect(result).toBe('env-id');
  });

  test('returns PromptResponse when no appId is provided or in env', () => {
    mockEnv.CONVERSATION_APP_ID = undefined;
    const result = getConversationAppId(undefined);
    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse).toStrictEqual({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'The "CONVERSATION_APP_ID" is not set in the environment variables and the "appId" property is not provided.',
        },
      ],
    });
  });
});
