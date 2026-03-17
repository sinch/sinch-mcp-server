import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../src/types';
import { registerCapabilities } from '../src/server';
import * as path from 'path';
import * as fs from 'fs';

jest.mock('@sinch/sdk-core/package.json', () => ({
  version: '1.0.0',
}), { virtual: true });

const loadTestCases = (useCase: string) => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'server', useCase);
  const files = fs.readdirSync(fixturesDir);
  return files.filter(file => file.endsWith('.json')).map(file => {
    const filePath = path.join(fixturesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  });
};

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
  process.env.PROJECT_ID = 'test-project-id';
  process.env.KEY_ID = 'test-key-id';
  process.env.KEY_SECRET = 'test-key-secret';
  process.env.APPLICATION_KEY = 'test-application-key';
  process.env.APPLICATION_SECRET = 'test-application-secret';
}

interface TagFilteringTestCase {
  tag: Tags;
  expectedTools: string[];
  expectedPrompts: string[];
}

describe('MCP Server capability registration', () => {

  const testCases: TagFilteringTestCase[] = loadTestCases('tag-filtering');

  beforeEach(() => {
    setEnvVariables();
  })

  for (const testCase of testCases) {
    it(`registers tools and prompts matching the '${testCase.tag}' tag`, () => {
      // Given
      const server = new McpServer({ name: 'Test', version: 'test', capabilities: { resources: {}, tools: {}, prompts: {} } });
      // When
      registerCapabilities(server, [testCase.tag]);
      // Then
      const tools = getRegisteredToolNames(server);
      expect(tools).toEqual(testCase.expectedTools.sort());
      const prompts = getRegisteredPromptNames(server);
      expect(prompts).toEqual(testCase.expectedPrompts.sort());
    });
  }

  it('registers all tools and prompts when no tags are provided', () => {
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
