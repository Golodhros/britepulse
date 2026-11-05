import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser',
  outputDir: './.artifacts/browser-results',
  workers: 1,
  use: {
    browserName: 'chromium',
    channel: process.platform === 'darwin' && !process.env.CHROME_PATH ? 'chrome' : undefined,
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
