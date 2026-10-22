import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', '.claude'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // shadcn/ui components export variants next to components by design.
    files: ['src/ui/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // The engine is pure: no React, no storage, no clock (ADR 0004).
    files: ['src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'zustand', '@/app/*', '@/storage/*', '@/ui/*', '@/i18n/*'] },
      ],
      'no-restricted-globals': ['error', 'localStorage', 'window', 'document'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Time is passed into the engine (at/now).' },
        { object: 'Math', property: 'random', message: 'Randomness is passed into the engine as a seed.' },
      ],
    },
  },
);
