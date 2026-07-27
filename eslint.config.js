import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-self-assign': 'error',
      'no-constant-binary-expression': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use custom modal or toast instead.' },
        { name: 'confirm', message: 'Use custom confirm modal instead.' }
      ]
    }
  }
];
