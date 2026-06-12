import { defineConfig } from 'vitest/config';

// Windows GitHub Actions runners have markedly slower file I/O and process spawn,
// so subprocess- and git-heavy setup hooks can exceed the 10s default hookTimeout
// under parallel load. Raise the hook budget there to remove that flake class
// without masking genuine hangs elsewhere.
const isWindows = process.platform === 'win32';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Strip inherited GIT_DIR (and friends) in every worker before tests spawn
    // subprocesses, so an ambient git env (e.g. from a pre-push hook run in a
    // linked worktree) cannot redirect fixture git/tbd onto the real repo.
    // See tests/scrub-git-env.ts and the tbd-a1lc incident.
    setupFiles: ['tests/scrub-git-env.ts'],
    hookTimeout: isWindows ? 30000 : 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // Note: test:coverage merges vitest coverage with tryscript CLI coverage
      // using --merge-lcov and --coverage-monocart for accurate line counts.
    },
  },
});
