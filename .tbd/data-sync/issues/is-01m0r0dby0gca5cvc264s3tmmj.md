---
type: is
id: is-01m0r0dby0gca5cvc264s3tmmj
title: Stabilize load-sensitive full-suite timeouts
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m0qxb2r48hpyfvzbpbcrnh3w
created_at: 2026-08-23T19:08:59.711Z
updated_at: 2026-08-28T19:55:50.866Z
---
A full pnpm run ci completed 2,428/2,430 tests but doc-references exceeded 60s and git-remote large-repository setup exceeded 5s under suite-wide load. The same two files passed 22/22 in isolation; doc references completed in 18.7s and the status filter itself took 13ms after fixture creation. Reproduce under full concurrency, separate fixture/setup timeout accounting from the measured assertion, and retain bounded failure detection rather than globally raising timeouts.

## Notes

2026-08-23 PR #260 narrowed-stack validation: full pnpm run ci passed 161/162 files and 2,435 tests but git-remote large-repository thresholds missed under suite-wide contention (list timed out at 5.143s; random-read average 22.29ms). The same file immediately passed 20/20 alone: list 875.50ms and random-read average 0.19ms, max 0.38ms. This strengthens the diagnosis that fixture/scheduler load is counted inside fixed performance assertions.
