import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tags } from '../src/types';
import { parseArgs, registerCapabilities } from '../src/server';
import { mockEnv, resetMockEnv } from './helpers/mock-env';
import * as path from 'path';
import * as fs from 'fs';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

const loadTestCases = (useCase: string) => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'server', useCase);
  const files = fs.readdirSync(fixturesDir);
  return files
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const filePath = path.join(fixturesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    });
};

const getRegisteredToolNames = (server: McpServer) => {
  const tools = (server as any)._registeredTools;
  return tools ? Object.keys(tools).sort() : [];
};

const getRegisteredPromptNames = (server: McpServer) => {
  const prompts = (server as any)._registeredPrompts;
  return prompts ? Object.keys(prompts).sort() : [];
};

const setEnvVariables = () => {
  process.env.MAILGUN_API_KEY = 'test-mailgun-api-key';
  process.env.PROJECT_ID = 'test-project-id';
  process.env.KEY_ID = 'test-key-id';
  process.env.KEY_SECRET = 'test-key-secret';
  process.env.APPLICATION_KEY = 'test-application-key';
  process.env.APPLICATION_SECRET = 'test-application-secret';
};

interface TagFilteringTestCase {
  tag: Tags;
  expectedTools: string[];
  expectedPrompts: string[];
}

describe('parseArgs', () => {
  const argv = (...args: string[]) => ['node', 'dist/index.js', ...args];

  afterEach(() => {
    resetMockEnv();
  });

  it('returns the tags from the --tags argument', () => {
    expect(parseArgs(argv('--tags', 'conversation,verification'))).toEqual(['conversation', 'verification']);
  });

  it('falls back on the MCP_TAGS environment variable when no --tags argument is present', () => {
    mockEnv.MCP_TAGS = 'conversation,verification';
    expect(parseArgs(argv())).toEqual(['conversation', 'verification']);
  });

  it('prefers the --tags argument over the MCP_TAGS environment variable', () => {
    mockEnv.MCP_TAGS = 'email';
    expect(parseArgs(argv('--tags', 'voice'))).toEqual(['voice']);
  });

  it('returns an empty array when neither --tags nor MCP_TAGS is set', () => {
    expect(parseArgs(argv())).toEqual([]);
  });
});

describe('MCP Server capability registration', () => {
  const testCases: TagFilteringTestCase[] = loadTestCases('tag-filtering');

  beforeEach(() => {
    setEnvVariables();
  });

  for (const testCase of testCases) {
    it(`registers tools and prompts matching the '${testCase.tag}' tag`, () => {
      // Given
      const server = new McpServer({
        name: 'Test',
        version: 'test',
        capabilities: { resources: {}, tools: {}, prompts: {} },
      });
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
    const server = new McpServer({
      name: 'Test',
      version: 'test',
      capabilities: { resources: {}, tools: {}, prompts: {} },
    });
    // When
    registerCapabilities(server, []);
    // Then
    const tools = getRegisteredToolNames(server);
    expect(tools).toEqual(
      testCases
        .filter((testCase) => testCase.tag === 'all')
        .flatMap((testCase) => testCase.expectedTools)
        .sort(),
    );
    const prompts = getRegisteredPromptNames(server);
    expect(prompts).toEqual(
      testCases
        .filter((testCase) => testCase.tag === 'all')
        .flatMap((testCase) => testCase.expectedPrompts)
        .sort(),
    );
  });
});
