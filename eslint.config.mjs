import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// One config for the whole monorepo. Security rules come from CLAUDE.md.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '**/.next/**',
    '**/.turbo/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'supabase/**',
  ]),
  {
    settings: {
      next: { rootDir: ['apps/web/', 'apps/control/'] },
      react: { version: '19' },
    },
    rules: {
      // Rule 5: user text is always rendered as text.
      'react/no-danger': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Rule 1: read env vars only through each app's env.ts, so the Zod check sees every one.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read environment variables through env.ts only.',
        },
      ],
    },
  },
  {
    // Places allowed to touch process.env directly.
    files: [
      '**/env.ts',
      '**/*.config.{ts,mjs,js}',
      'packages/core/src/env-check.ts',
      'e2e/**',
      '**/*.test.ts',
      'scripts/**',
      'tools/**',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
]);
