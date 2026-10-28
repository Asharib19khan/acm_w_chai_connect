import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Student site on :3000, control app on :3001. Blueprint section 15 device set.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Windows dev machines crash with many parallel browsers while dev servers compile.
  workers: 2,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: [
    {
      command: isCI ? 'pnpm --filter @chai/web start' : 'pnpm --filter @chai/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: isCI ? 'pnpm --filter @chai/control start' : 'pnpm --filter @chai/control dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
