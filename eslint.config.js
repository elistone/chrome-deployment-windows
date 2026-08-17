import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-harness/**',
      'release/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      // The codebase uses the automatic JSX runtime.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ['scripts/**/*.js', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
)
