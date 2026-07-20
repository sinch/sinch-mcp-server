import type { Config } from 'jest';

/**
 * Jest config for the statistical LLM evals (tests/eval/llms). Like the
 * integration config (ESM, ts-jest), but with a long timeout since each suite
 * runs many iterations. Invoked via `npm run test:eval`.
 */
const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.integration.json' }],
  },
  roots: ['<rootDir>/tests/eval/llms'],
  testMatch: ['**/*.eval.test.ts'],
  moduleFileExtensions: ['ts', 'mjs', 'js', 'json', 'node'],
  setupFilesAfterEnv: ['jest-extended/all'],
  testTimeout: 30 * 60 * 1000,
  forceExit: true,
};

export default config;
