import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../src/types';
import { registerCapabilities } from '../src/server';
import { ENABLED, toolsStatusMap } from '../src/tools-config';

const getRegisteredToolNames = (server: McpServer) => {
  const tools = (server as any)._registeredTools;
  return tools ? Object.keys(tools).sort() : [];
}

const getRegisteredPromptNames = (server: McpServer) => {
  const prompts = (server as any)._registeredPrompts;
  return prompts ? Object.keys(prompts).sort() : [];
}

const setEnvVariables = () => {
  process.env.MAILGUN_API_KEY = 'test-mailgun-api-key';
  process.env.CONVERSATION_PROJECT_ID = 'test-conversation-project-id';
  process.env.CONVERSATION_KEY_ID = 'test-conversation-key-id';
  process.env.CONVERSATION_KEY_SECRET = 'test-conversation-key-secret';
  process.env.NGROK_AUTH_TOKEN = 'test-ngrok-auth-token';
  process.env.VERIFICATION_APPLICATION_KEY = 'test-verification-application-key';
  process.env.VERIFICATION_APPLICATION_SECRET = 'test-verification-application-secret';
  process.env.VOICE_APPLICATION_KEY = 'test-voice-application-key';
  process.env.VOICE_APPLICATION_SECRET = 'test-voice-application-secret';
}

describe('Tool registration by tag', () => {

  beforeEach(() => {
    setEnvVariables();
  })

  const testCases: { tag: Tags; expectedTools: string[], expectedPrompts: string[] }[] = [
    {
      tag: 'email',
      expectedTools: [
        'list-email-events',
        'list-email-templates',
        'analytics-metrics',
        'retrieve-email-info',
        'send-email',
        'sinch-mcp-configuration'
      ],
      expectedPrompts: []
    },
    {
      tag: 'conversation',
      expectedTools: [
        'get-message-events',
        'list-conversation-apps',
        'list-messaging-templates',
        'send-choice-message',
        'send-location-message',
        'send-media-message',
        'send-template-message',
        'send-text-message',
        'sinch-mcp-configuration'
      ],
      expectedPrompts: [
        'conversation-app-id'
      ]
    },
    {
      tag: 'verification',
      expectedTools: [
        'number-lookup',
        'report-sms-verification',
        'start-sms-verification',
        'sinch-mcp-configuration'
      ],
      expectedPrompts: []
    },
    {
      tag: 'voice',
      expectedTools: [
        'close-conference',
        'conference-callout',
        'manage-conference-participant',
        'tts-callout',
        'sinch-mcp-configuration'
      ],
      expectedPrompts: []
    },
    {
      tag: 'notification',
      expectedTools: [
        'send-email',
        'retrieve-email-info',
        'list-email-templates',
        'tts-callout',
        'get-message-events',
        'send-text-message',
        'send-location-message',
        'send-choice-message',
        'send-media-message',
        'send-template-message',
        'list-conversation-apps',
        'list-messaging-templates',
        'sinch-mcp-configuration'
      ],
      expectedPrompts: [
        'conversation-app-id'
      ]
    },
    {
      tag: 'all',
      expectedTools: [
        'list-email-events',
        'list-email-templates',
        'analytics-metrics',
        'retrieve-email-info',
        'send-email',
        'get-message-events',
        'list-conversation-apps',
        'list-messaging-templates',
        'send-choice-message',
        'send-location-message',
        'send-media-message',
        'send-template-message',
        'send-text-message',
        'number-lookup',
        'report-sms-verification',
        'start-sms-verification',
        'close-conference',
        'conference-callout',
        'manage-conference-participant',
        'tts-callout',
        'sinch-mcp-configuration'
      ],
      expectedPrompts: [
        'conversation-app-id'
      ]
    }
  ];

  for (const { tag, expectedTools, expectedPrompts } of testCases) {
    it(`registers correct tools when tag is '${tag}'`, () => {
      // Given
      const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
      // When
      registerCapabilities(server, [tag]);
      // Then
      const tools = getRegisteredToolNames(server);
      expect(tools).toEqual(expectedTools.sort());
      const prompts = getRegisteredPromptNames(server);
      expect(prompts).toEqual(expectedPrompts.sort());
    });
  }

  it('registers all tools when no tags are provided', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    // When
    registerCapabilities(server, []);
    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).toEqual(testCases
      .filter((testCase) => testCase.tag === 'all')
      .flatMap((testCase) => testCase.expectedTools)
      .sort()
    );
    const prompts = getRegisteredPromptNames(server);
    expect(prompts).toEqual(testCases
      .filter((testCase) => testCase.tag === 'all')
      .flatMap((testCase) => testCase.expectedPrompts)
      .sort());
  });
});

describe('Tool registration when environment variables are missing', () => {

  beforeEach(() => {
    setEnvVariables();
  })

  it('should register no email tools when MAILGUN_API_KEY is missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.MAILGUN_API_KEY = '';

    // When
    registerCapabilities(server, []);

    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).not.toContain('list-email-events');
    expect(tools).not.toContain('list-email-templates');
    expect(tools).not.toContain('analytics-metrics');
    expect(tools).not.toContain('retrieve-email-info');
    expect(tools).not.toContain('send-email');
    expect(tools).toContain('sinch-mcp-configuration');
    expect(tools).toContain('send-text-message');
    expect(tools).toContain('number-lookup');
    expect(tools).toContain('tts-callout');
    const incorrectMailgunConfig = 'Incorrect configuration. The environment variable "MAILGUN_API_KEY" is not set.';
    expect(toolsStatusMap['analytics-metrics']).toBe(incorrectMailgunConfig);
    expect(toolsStatusMap['retrieve-email-info']).toBe(incorrectMailgunConfig);
    expect(toolsStatusMap['send-email']).toBe(incorrectMailgunConfig);
    expect(toolsStatusMap['list-email-events']).toBe(incorrectMailgunConfig);
    expect(toolsStatusMap['list-email-templates']).toBe(incorrectMailgunConfig);
    expect(toolsStatusMap['sinch-mcp-configuration']).toBe(ENABLED);
    expect(toolsStatusMap['send-text-message']).toBe(ENABLED);
    expect(toolsStatusMap['number-lookup']).toBe(ENABLED);
    expect(toolsStatusMap['tts-callout']).toBe(ENABLED);
  });

  it('should register no conversation tools when CONVERSATION_PROJECT_ID is missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.CONVERSATION_PROJECT_ID = '';

    // When
    registerCapabilities(server, []);

    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).not.toContain('get-message-events');
    expect(tools).not.toContain('list-conversation-apps');
    expect(tools).not.toContain('list-messaging-templates');
    expect(tools).not.toContain('send-choice-message');
    expect(tools).not.toContain('send-location-message');
    expect(tools).not.toContain('send-media-message');
    expect(tools).not.toContain('send-template-message');
    expect(tools).not.toContain('send-text-message');
    expect(tools).toContain('send-email');
    expect(tools).toContain('number-lookup');
    expect(tools).toContain('tts-callout');
    expect(tools).toContain('sinch-mcp-configuration');
    const incorrectConversationConfig = 'Incorrect configuration. The environment variables are not set: CONVERSATION_PROJECT_ID';
    expect(toolsStatusMap['list-conversation-apps']).toBe(incorrectConversationConfig);
    expect(toolsStatusMap['list-messaging-templates']).toBe(incorrectConversationConfig);
    expect(toolsStatusMap['send-choice-message']).toBe(incorrectConversationConfig);
    expect(toolsStatusMap['send-location-message']).toBe(incorrectConversationConfig);
    expect(toolsStatusMap['send-media-message']).toBe(incorrectConversationConfig);
    expect(toolsStatusMap['send-template-message']).toBe(incorrectConversationConfig);
    expect(toolsStatusMap['send-text-message']).toBe(incorrectConversationConfig);
  });

  it('should register all conversation tools expect "get-message-events" is NGROK_AUTH_TOKEN is missing', () => {
    // Given
    const server = new McpServer({
      name: 'Test',
      version: 'test',
      capabilities: { resources: {}, tools: {}, prompts: {} }
    });
    process.env.NGROK_AUTH_TOKEN = '';

    // When
    registerCapabilities(server, []);

    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).not.toContain('get-message-events');
    expect(tools).toContain('list-conversation-apps');
    expect(tools).toContain('list-messaging-templates');
    expect(tools).toContain('send-choice-message');
    expect(tools).toContain('send-location-message');
    expect(tools).toContain('send-media-message');
    expect(tools).toContain('send-template-message');
    expect(tools).toContain('send-text-message');
  });

  it('should list all the missing Conversation environment variables when multiple are missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.CONVERSATION_PROJECT_ID = '';
    process.env.CONVERSATION_KEY_ID = '';
    process.env.CONVERSATION_KEY_SECRET = '';

    // When
    registerCapabilities(server, []);

    // Then
    const incorrectConversationConfig = 'Incorrect configuration. The environment variables are not set: CONVERSATION_PROJECT_ID, CONVERSATION_KEY_ID, CONVERSATION_KEY_SECRET';
    expect(toolsStatusMap['list-conversation-apps']).toBe(incorrectConversationConfig);
  });

  it('should register no verification tools when VERIFICATION_APPLICATION_KEY is missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.VERIFICATION_APPLICATION_KEY = '';

    // When
    registerCapabilities(server, []);

    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).not.toContain('number-lookup');
    expect(tools).not.toContain('report-sms-verification');
    expect(tools).not.toContain('start-sms-verification');
    expect(tools).toContain('send-email');
    expect(tools).toContain('send-text-message');
    expect(tools).toContain('tts-callout');
    expect(tools).toContain('sinch-mcp-configuration');
    const incorrectVerificationConfig = 'Incorrect configuration. The environment variables are not set: VERIFICATION_APPLICATION_KEY';
    expect(toolsStatusMap['number-lookup']).toBe(incorrectVerificationConfig);
    expect(toolsStatusMap['report-sms-verification']).toBe(incorrectVerificationConfig);
    expect(toolsStatusMap['start-sms-verification']).toBe(incorrectVerificationConfig);
    expect(toolsStatusMap['sinch-mcp-configuration']).toBe(ENABLED);
  });

  it('should list all the missing Verification environment variables when multiple are missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.VERIFICATION_APPLICATION_KEY = '';
    process.env.VERIFICATION_APPLICATION_SECRET = '';

    // When
    registerCapabilities(server, []);

    // Then
    const incorrectConversationConfig = 'Incorrect configuration. The environment variables are not set: VERIFICATION_APPLICATION_KEY, VERIFICATION_APPLICATION_SECRET';
    expect(toolsStatusMap['number-lookup']).toBe(incorrectConversationConfig);
  });

  it('should register no voice tools when VOICE_APPLICATION_KEY is missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.VOICE_APPLICATION_KEY = '';

    // When
    registerCapabilities(server, []);

    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).not.toContain('close-conference');
    expect(tools).not.toContain('conference-callout');
    expect(tools).not.toContain('manage-conference-participant');
    expect(tools).not.toContain('tts-callout');
    expect(tools).toContain('send-email');
    expect(tools).toContain('send-text-message');
    expect(tools).toContain('number-lookup');
    expect(tools).toContain('sinch-mcp-configuration');
    const incorrectVoiceConfig = 'Incorrect configuration. The environment variables are not set: VOICE_APPLICATION_KEY';
    expect(toolsStatusMap['close-conference']).toBe(incorrectVoiceConfig);
    expect(toolsStatusMap['conference-callout']).toBe(incorrectVoiceConfig);
    expect(toolsStatusMap['manage-conference-participant']).toBe(incorrectVoiceConfig);
    expect(toolsStatusMap['tts-callout']).toBe(incorrectVoiceConfig);
  });

  it('should list all the missing Voice environment variables when multiple are missing', () => {
    // Given
    const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
    process.env.VOICE_APPLICATION_KEY = '';
    process.env.VOICE_APPLICATION_SECRET = '';

    // When
    registerCapabilities(server, []);

    // Then
    const incorrectVoiceConfig = 'Incorrect configuration. The environment variables are not set: VOICE_APPLICATION_KEY, VOICE_APPLICATION_SECRET';
    expect(toolsStatusMap['tts-callout']).toBe(incorrectVoiceConfig);
  });

});
