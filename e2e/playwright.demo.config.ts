import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
    viewport: { width: 1920, height: 1080 },
    launchOptions: { slowMo: 1500 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd .. && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
