---
type: is
id: is-01m044p8vkya3s129dqr09qszy
title: Wall-clock perf assertions flake under parallel load and coverage
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-16T01:58:57.138Z
updated_at: 2026-08-16T01:58:57.138Z
---
Two timing-asserted tests failed during the 2026-08-15 verification and passed in isolation moments later:

- tests/performance.test.ts 'reads 100 random issues in <500ms' — failed under `vitest run --coverage`, then measured 190ms alone.
- tests/git-remote.test.ts 'reads random issues from large repo in <10ms each' — failed at load average 44, passed at 18.

Both assert wall-clock against a fixed budget, so they measure the machine, not the code. Under coverage instrumentation or a loaded CI runner they will fail intermittently. Worse, a flake here aborts `test:coverage` before the tryscript goldens run at all (the script is `vitest run --coverage && tryscript run`), so an unrelated timing blip silently skips 1101 golden assertions.

Options: raise the budgets substantially, skip them under coverage, or convert to a relative/regression check. At minimum decouple the goldens so they run regardless.
