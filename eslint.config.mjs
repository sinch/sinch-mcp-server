import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-config-prettier';
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
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',

      'semi': 'warn',
      'comma-dangle': 'warn',
      'quotes': ['warn', 'single'],

      'jest-extended/prefer-to-be-true': 'warn',
      'jest-extended/prefer-to-be-false': 'error',
      'jest-formatting/padding-around-describe-blocks': 2,
      'jest-formatting/padding-around-test-blocks': 2,
      'jest/expect-expect': 'error',

      'curly': ['error', 'all'],
      'indent': ['error', 2],
      'object-curly-spacing': [
        'error',
        'always',
        {
          objectsInObjects: true,
          arraysInObjects: true,
        },
      ],
      'require-jsdoc': 'off',
      'operator-linebreak': ['error', 'before'],
      'max-len': [
        'error',
        {
          code: 120,
          ignoreUrls: true,
          ignoreComments: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignorePattern: '^import.+|test',
        },
      ],
      'new-cap': 'off',
    },
  },
  eslintPluginPrettierRecommended,
];
