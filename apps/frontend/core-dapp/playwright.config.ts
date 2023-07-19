import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  reporter: 'html',
  retries: 0,
  testDir: './e2e',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.prepo.io/',
    trace: process.env.CI ? 'on-first-retry' : 'on',
  },
  workers: process.env.CI ? 1 : undefined,
  timeout: 5 * 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
})
