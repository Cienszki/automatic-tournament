/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Two projects, so CI can run them as separate jobs (`vitest run --project unit|db`); `npm test`
// runs both. A database test is a file under src/platform/db or named `*.db.test.ts`: it opens a
// PGlite database through src/platform/db/testing.ts, and the `db` job also gives it CI's
// PostgreSQL container (TEST_DATABASE_URL). Every other test file is a unit test.
const DB_TESTS = ['src/platform/db/**/*.test.ts', '**/*.db.test.ts'];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/hooks/**', 'src/components/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.ts'],
          exclude: ['**/node_modules/**', ...DB_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: DB_TESTS,
          exclude: ['**/node_modules/**'],
          // Migrates the test database copy once per run (src/platform/db/testing.ts).
          globalSetup: ['./src/platform/db/test-global-setup.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Bundled by Next.js, not an installed package — server modules import it
      'server-only': path.resolve(__dirname, './src/__tests__/stubs/server-only.ts'),
    },
  },
});
