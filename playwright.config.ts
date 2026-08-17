import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Each test drives its own persistent browser profile with the extension
  // loaded, so workers are kept to one to avoid profile contention.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The extension only matches https, and the tests stub those responses
    // rather than hitting the network.
    baseURL: 'https://github.com',
  },
})
