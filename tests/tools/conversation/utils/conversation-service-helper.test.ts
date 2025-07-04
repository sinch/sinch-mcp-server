import {
  getConversationClient,
  getConversationTemplateClient,
  getConversationAppId,
  getConversationRegion,
} from '../../../../src/tools/conversation/utils/conversation-service-helper';
import { PromptResponse } from '../../../../src/types';
import {
  ConversationRegion,
  SinchClient,
  ApiFetchClient,
} from '@sinch/sdk-core';
import { formatUserAgent } from '../../../../src/utils';

const mockApi = () => ({
  setHostname: jest.fn(),
});

jest.mock('@sinch/sdk-core', () => {
  const actual = jest.requireActual('@sinch/sdk-core');
  return {
    ...actual,
    SinchClient: jest.fn(() => ({
      conversation: {
        app: mockApi(),
        contact: mockApi(),
        conversation: mockApi(),
        messages: mockApi(),
        events: mockApi(),
        capability: mockApi(),
        transcoding: mockApi(),
        webhooks: mockApi(),
        templatesV2: mockApi(),
      },
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
    process.env.CONVERSATION_PROJECT_ID = PROJECT_ID;
    process.env.CONVERSATION_KEY_ID = 'test-key-id';
    process.env.CONVERSATION_KEY_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns a configured SinchClient from getConversationService', async () => {
    const client = getConversationClient(TOOL_NAME);
    expect(client).toHaveProperty('conversation');

    const apis = (client as SinchClient).conversation;
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

  test('returns a configured SinchClient from getConversationTemplateService', async () => {
    const client = getConversationTemplateClient(TOOL_NAME);
    expect(client).toHaveProperty('conversation');

    const api = (client as SinchClient).conversation.templatesV2;
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
    delete process.env.CONVERSATION_PROJECT_ID;
    const result = getConversationClient(TOOL_NAME);
    expect(result).toBeInstanceOf(PromptResponse);
    expect((result as PromptResponse).promptResponse).toStrictEqual({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Missing env vars: CONVERSATION_PROJECT_ID, CONVERSATION_KEY_ID, CONVERSATION_KEY_SECRET.',
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

describe('getConversationRegion', () => {
  test('returns provided region if given', () => {
    const result = getConversationRegion('eu');
    expect(result).toBe('eu');
  });

  test('returns env region if not provided', () => {
    process.env.CONVERSATION_REGION = 'br';
    const result = getConversationRegion(undefined);
    expect(result).toBe('br');
  });

  test('returns default region if nothing is provided', () => {
    delete process.env.CONVERSATION_REGION;
    const result = getConversationRegion(undefined);
    expect(result).toBe(ConversationRegion.UNITED_STATES);
  });
});
