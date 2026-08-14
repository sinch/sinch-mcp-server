import { createHttpApp } from '../src/http';
import { clearHttpCredentialSourceForTests, getHttpCredentialSource } from '../src/auth/http-credential-mode';
import { mockEnv, resetMockEnv } from './helpers/mock-env';

jest.mock(
  '@sinch/sdk-core/package.json',
  () => ({
    version: '1.0.0',
  }),
  { virtual: true },
);

describe('createHttpApp startup validation', () => {
  const originalMcpApiKey = process.env.MCP_API_KEY;
  const originalMcpApiKeys = process.env.MCP_API_KEYS;

  beforeEach(() => {
    resetMockEnv();
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_API_KEYS;
  });

  afterEach(() => {
    clearHttpCredentialSourceForTests();
  });

  afterAll(() => {
    if (originalMcpApiKey !== undefined) {
      process.env.MCP_API_KEY = originalMcpApiKey;
    }
    if (originalMcpApiKeys !== undefined) {
      process.env.MCP_API_KEYS = originalMcpApiKeys;
    }
  });

  test('throws in multi-tenant mode when CONVERSATION_REGION is not set', () => {
    expect(() => createHttpApp()).toThrow(
      'The server is starting in multi-tenant mode because neither MCP_API_KEY nor MCP_API_KEYS is set. ' +
        'In multi-tenant mode, the CONVERSATION_REGION environment variable is required',
    );
  });

  test('starts in multi-tenant mode when CONVERSATION_REGION is set', () => {
    mockEnv.CONVERSATION_REGION = 'eu';
    expect(() => createHttpApp()).not.toThrow();
    expect(getHttpCredentialSource()).toBe('request-header');
  });

  test('does not require CONVERSATION_REGION in single-tenant mode', () => {
    process.env.MCP_API_KEY = 'test-api-key';
    expect(() => createHttpApp()).not.toThrow();
    expect(getHttpCredentialSource()).toBe('env');
  });
});
