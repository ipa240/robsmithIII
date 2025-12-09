import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://vanurses.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // API tests - no auth needed
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // Public page tests - no auth needed
    {
      name: 'public',
      testMatch: /auth\.spec\.ts|navigation\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // Setup project to handle authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Authenticated tests
    {
      name: 'chromium',
      testIgnore: /api\.spec\.ts|auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile viewport tests
    {
      name: 'mobile-chrome',
      testIgnore: /api\.spec\.ts|auth\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
