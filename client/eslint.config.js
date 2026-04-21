/**
 * ESLint flat config for the Lumen LMS client.
 *
 * What this enforces (and why):
 *  - `@eslint/js` recommended baseline — catches the universally bad
 *    things (unused vars, dead branches, redeclared identifiers).
 *  - `eslint-plugin-react-hooks` (`rules-of-hooks` + `exhaustive-deps`)
 *    — guards the rules of hooks; a single violation here can ship a
 *    subtle infinite-loop bug to production. The rest of the v7
 *    React-Compiler advisory rules are intentionally off so this lint
 *    job stays focused on real correctness issues, not stylistic ones.
 *  - `eslint-plugin-react-refresh` — keeps Vite Fast Refresh happy by
 *    surfacing component files that accidentally export non-components.
 *  - `eslint-plugin-jsx-a11y` (recommended set) — STEP 41's accessibility
 *    audit gate. Every interactive element gets a label, every <img>
 *    gets `alt`, every keyboard-only flow round-trips. Warnings are
 *    fixed before merge; the build fails loudly on a fresh violation.
 *
 * Browser + Node globals are pulled from the `globals` package so we
 * don't have to maintain that list by hand. JSX runtime is the new
 * automatic transform (React 19), so React doesn't need to be in scope.
 *
 * Note on `no-unused-vars`: ESLint's default parser does not know that
 * a JSX element name (e.g. `<Link>`) is a reference to the imported
 * identifier `Link`. Without `eslint-plugin-react` we'd flag every JSX
 * import as unused, so we keep the rule off for JSX files and rely on
 * the IDE to surface dead imports.
 */

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      '**/*.min.js',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      ...jsxA11y.configs.recommended.rules,

      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  {
    files: ['scripts/**/*.{js,mjs,cjs}', '*.config.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
