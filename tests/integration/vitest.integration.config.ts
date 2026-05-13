import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30_000,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['functions/**'],
      exclude: [
        'functions/**/*.d.ts',
        'functions/tsconfig.json',
        // Route entry wrappers: one-line PagesFunction adapters around
        // _shared/handlers. Require a full Pages runtime to exercise;
        // their handler bodies are covered via direct invocation in tests.
        'functions/api/lists/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
})
