import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../src/types';
import { registerCapabilities } from '../src/server';

const getRegisteredToolNames = (server: McpServer) => {
  const tools = (server as any)._registeredTools;
  return tools ? Object.keys(tools).sort() : [];
}

const getRegisteredPromptNames = (server: McpServer) => {
  const prompts = (server as any)._registeredPrompts;
  return prompts ? Object.keys(prompts).sort() : [];
}

describe('Tool registration by tag', () => {

  const testCases: { tag: Tags; expectedTools: string[], expectedPrompts: string[] }[] = [
    {
      tag: 'email',
      expectedTools: [
        'analytics-metrics',
        'list-email-events',
        'retrieve-email-info',
        'send-email'
      ],
      expectedPrompts: []
    },
    {
      tag: 'conversation',
      expectedTools: [
        'list-all-apps',
        'list-all-templates',
        'send-choice-message',
        'send-location-message',
        'send-media-message',
        'send-template-message',
        'send-text-message'
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
        'start-sms-verification'
      ],
      expectedPrompts: []
    },
    {
      tag: 'voice',
      expectedTools: [
        'close-conference',
        'conference-call',
        'manage-conference-participant',
        'tts-callout'
      ],
      expectedPrompts: []
    },
    {
      tag: 'notification',
      expectedTools: [
        'send-email',
        'retrieve-email-info',
        'tts-callout',
        'send-text-message',
        'send-location-message',
        'send-choice-message',
        'send-media-message',
        'send-template-message',
        'list-all-apps',
        'list-all-templates',
      ],
      expectedPrompts: [
        'conversation-app-id'
      ]
    },
    {
      tag: 'all',
      expectedTools: [
        'analytics-metrics',
        'list-email-events',
        'retrieve-email-info',
        'send-email',
        'list-all-apps',
        'list-all-templates',
        'send-choice-message',
        'send-location-message',
        'send-media-message',
        'send-template-message',
        'send-text-message',
        'number-lookup',
        'report-sms-verification',
        'start-sms-verification',
        'close-conference',
        'conference-call',
        'manage-conference-participant',
        'tts-callout'
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
