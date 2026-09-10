import { defineConfig, devices } from '@playwright/test'

import { configureTestEnvironment } from './packages/shared/src/testEnv'
configureTestEnvironment()
const reuseExistingServer = false
process.env.PORT = '3101'
process.env.API_URL = 'http://localhost:3101'
process.env.WEB_URL = 'http://localhost:5181'
process.env.VITE_API_URL = process.env.API_URL
process.env.WEB_APP_URL = process.env.WEB_URL
process.env.CORS_ORIGIN = process.env.WEB_URL

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.WEB_URL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @webhook/worker dev',
      wait: { stdout: /worker_started/ },
      env: { LOG_LEVEL: 'info' },
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @webhook/api dev',
      url: 'http://localhost:3101/v1/health',
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @webhook/web dev --port 5181 --strictPort',
      url: 'http://localhost:5181',
      reuseExistingServer,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
