import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'pnpm --filter @anki-apkg-export/browser-example preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
