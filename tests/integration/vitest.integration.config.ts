import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30_000,
    setupFiles: []
  }
})
