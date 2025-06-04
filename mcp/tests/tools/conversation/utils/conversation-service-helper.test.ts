import {
  getConversationService,
  getConversationTemplateService,
  getConversationAppId,
  getConversationRegion,
} from '../../../../src/tools/conversation/utils/conversation-service-helper';
import { PromptResponse } from '../../../../src/types';
import {
  ConversationRegion,
  SinchClient,
  ApiFetchClient,
} from '@sinch/sdk-core';

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

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.CONVERSATION_PROJECT_ID = 'test-project';
    process.env.CONVERSATION_KEY_ID = 'test-key-id';
    process.env.CONVERSATION_KEY_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns a configured SinchClient from getConversationService', () => {
    const client = getConversationService();
    expect(client).toHaveProperty('conversation');

    const apis = (client as SinchClient).conversation;
    const expectedHostname = 'https://us.conversation.api.sinch.com';

    for (const [key, api] of Object.entries(apis)) {
      if (key !== 'templatesV2') {
        expect(api.setHostname).toHaveBeenCalledWith(expectedHostname);
        expect(api.client).toBeInstanceOf(ApiFetchClient);
      }
    }

  });

  test('returns a configured SinchClient from getConversationTemplateService', () => {
    const client = getConversationTemplateService();
    expect(client).toHaveProperty('conversation');

    const api = (client as SinchClient).conversation.templatesV2;
    const expectedHostname = 'https://us.template.api.sinch.com';

    expect(api.setHostname).toHaveBeenCalledWith(expectedHostname);
    expect(api.client).toBeInstanceOf(ApiFetchClient);
    expect(api.client!.apiClientOptions.requestPlugins?.length).toBe(2);
  });

  test('returns PromptResponse when env vars are missing', () => {
    delete process.env.CONVERSATION_PROJECT_ID;
    const result = getConversationService();
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
