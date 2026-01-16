import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // Note: CLI commands are tested via golden tests (subprocess execution),
      // which vitest's v8 coverage cannot directly measure.
      // Golden tests use our custom runner in tests/golden/runner.ts.
      // For full CLI coverage, consider migrating to tryscript-based golden tests
      // with --coverage --merge-lcov to merge subprocess coverage.
    },
  },
});
