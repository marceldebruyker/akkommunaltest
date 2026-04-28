// Flat ESLint config (ESLint 9). Keep the rule set lean: catch real bugs,
// don't bikeshed. Stricter rules can be added later once the codebase is
// already passing the basics.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import astroPlugin from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', '.astro/**', '.vercel/**', 'node_modules/**', 'public/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: {
        // Browser + Node globals we actually use without importing.
        window: 'readonly', document: 'readonly', console: 'readonly',
        fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
        Response: 'readonly', Request: 'readonly', FormData: 'readonly',
        Buffer: 'readonly', process: 'readonly', setTimeout: 'readonly',
        clearTimeout: 'readonly', SubmitEvent: 'readonly',
        HTMLFormElement: 'readonly', HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly', HTMLTextAreaElement: 'readonly',
        HTMLElement: 'readonly', MutationObserver: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  ...astroPlugin.configs.recommended,
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: { parser: tsParser, extraFileExtensions: ['.astro'] }
    },
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
