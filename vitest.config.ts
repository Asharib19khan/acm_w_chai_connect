import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(
        new URL('./packages/db/test/server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    fileParallelism: false,
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.{ts,tsx}',
      'tools/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/.next/**'],
    coverage: {
      include: ['packages/core/src/**'],
      thresholds: {
        'packages/core/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
