---
type: is
id: is-01m044p8vkya3s129dqr09qszy
title: Wall-clock perf assertions flake under parallel load and coverage
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
created_at: 2026-08-16T01:58:57.138Z
updated_at: 2026-08-28T19:55:42.524Z
---
Wall-clock and git-heavy tests fail intermittently under parallel load. Evidence from 2026-08-15/16, every one passing in isolation immediately after:

- tests/performance.test.ts 'reads 100 random issues in <500ms' — failed under `vitest run --coverage`; measured 190ms alone.
- tests/git-remote.test.ts 'reads random issues from large repo in <10ms each' — failed at load average 44, passed at 18.
- At load average 34, one run failed 7 tests across 4 files: common-dir-layout-doctor (2), git-remote 'pushes sync branch to remote', setup-hooks (2), worktree-health (2). All four files passed in isolation, and the whole suite passed at load average 7.

So this is wider than the two timing assertions: the git and worktree tests are load-sensitive too, presumably through git subprocess timing and shared temp-dir pressure.

Two distinct problems:

1. Flaky signal. The budgets measure the machine, not the code.
2. A flake in the vitest half aborts `test:coverage` before the tryscript goldens run at all — the script is `vitest run --coverage && tryscript run` — so an unrelated blip silently skips 1101 golden assertions. This bit the 2026-08-15 verification directly.

Fix (2) regardless of (1): the goldens should run even when vitest fails. For (1): raise the budgets, skip them under coverage, or cap concurrency for the git-heavy files.
