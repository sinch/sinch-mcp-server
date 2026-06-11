import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';
import jestFormatting from 'eslint-plugin-jest-formatting';
import jestExtended from 'eslint-plugin-jest-extended';
import globals from 'globals';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...jest.environments.globals.globals,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      jest,
      'jest-formatting': jestFormatting,
      'jest-extended': jestExtended,
      'prettier': eslintPluginPrettier,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...eslintConfigPrettier.rules,

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',

      'jest-extended/prefer-to-be-true': 'warn',
      'jest-extended/prefer-to-be-false': 'error',
      'jest-formatting/padding-around-describe-blocks': 2,
      'jest-formatting/padding-around-test-blocks': 2,
      'jest/expect-expect': 'error',

      'curly': ['error', 'all'],
      'require-jsdoc': 'off',
      'new-cap': 'off',
      'prettier/prettier': 'warn',
    },
  }
];
