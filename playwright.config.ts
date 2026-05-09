import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run build && npx wrangler d1 execute grocerieslist-sync --local --file=schema.sql && npx wrangler pages dev dist --port 4173 --show-interactive-dev-session false',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', reducedMotion: 'reduce' } }]
})
