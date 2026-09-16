---
type: is
id: is-01m0r0dby0gca5cvc264s3tmmj
title: Stabilize load-sensitive full-suite timeouts
kind: bug
status: open
priority: 2
version: 10
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m0qxb2r48hpyfvzbpbcrnh3w
created_at: 2026-08-23T19:08:59.711Z
updated_at: 2026-09-16T08:26:41.026Z
extensions:
  linear:
    id: 90300b49-0204-408c-bd8e-238eeb0836fe
    linked_at: 2026-09-16T08:26:41.026Z
---
A full pnpm run ci completed 2,428/2,430 tests but doc-references exceeded 60s and git-remote large-repository setup exceeded 5s under suite-wide load. The same two files passed 22/22 in isolation; doc references completed in 18.7s and the status filter itself took 13ms after fixture creation. Reproduce under full concurrency, separate fixture/setup timeout accounting from the measured assertion, and retain bounded failure detection rather than globally raising timeouts.

## Notes

2026-09-15/16 main 7120d16f plus docs-only audit commit 638fe79e: pnpm run ci passed format, lint, typecheck, and build, then Vitest finished 172 files green and 4 failed under suite-wide load. worktree-health migration commit, rescue-divergence short-ID collision, and child-order beforeEach hit 5s/10s timeouts; git-remote random-read averaged 11.52ms against the 10ms bound. Every failed case passed immediately in isolation: 0.656s, 0.918s, 0.991s, and 0.44ms average/5.12ms max respectively. A follow-up VITEST_MAX_WORKERS=4 pnpm test made contention substantially worse and was interrupted after progress stopped. The mandatory pre-push run later completed with quality, build, and package-age green but 12 tests in 7 files failed under full-suite load: agent-map validation, doc references, git-remote performance, golden output, import collision, performance, and setup hooks. Exactly those 7 files then passed serially: 7 files and 60 tests green; 5000-issue listing 948.85ms, random reads 0.33ms average, 1000-issue listing 193.53ms, doc references 15.25s. No deterministic product regression reproduced. Exact-main hosted CI run 35052496902 passed; retain this as gate-reliability debt rather than weakening product bounds.
