// Playwright settings for the read-only smoke test (site.spec.ts). `npm run smoke` uses this file.
// SMOKE_BROWSER_CHANNEL=msedge (or chrome) uses an installed browser instead of Playwright's own,
// so the test runs on a machine where `npx playwright install` was never run.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'site.spec.ts',
  timeout: 60_000,
  retries: 1,
  workers: 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: '../../.local/smoke-results',
  use: {
    channel: process.env.SMOKE_BROWSER_CHANNEL || undefined,
    locale: 'pl-PL',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
});
