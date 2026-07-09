import type { Config } from 'jest';

/**
 * Jest config for the mcp-jam integration tests (tests/integration/llms).
 *
 * Runs in ESM mode because @mcpjam/sdk (and its `ai` dependency) are pure ESM,
 * which Jest's default CommonJS runtime can't require. Invoked via
 * `npm run test:integration` (which sets --experimental-vm-modules).
 */
const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.integration.json' }],
  },
  roots: ['<rootDir>/tests/integration/llms'],
  testMatch: ['**/*.int.test.ts'],
  moduleFileExtensions: ['ts', 'mjs', 'js', 'json', 'node'],
  setupFilesAfterEnv: ['jest-extended/all'],
  // No test should hang the run: cap each test, and force-exit so a lingering
  // MCP stdio child process can't keep the Jest process alive after teardown.
  testTimeout: 120_000,
  forceExit: true,
};

export default config;
