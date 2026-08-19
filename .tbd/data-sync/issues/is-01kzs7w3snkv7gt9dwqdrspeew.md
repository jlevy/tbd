---
type: is
id: is-01kzs7w3snkv7gt9dwqdrspeew
title: Prove the 10k web response ceiling above its boundary
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - performance
  - pr-207
dependencies: []
parent_id: is-01kzs5fg2amah8bnpy3mct8khd
created_at: 2026-08-11T20:22:55.539Z
updated_at: 2026-08-11T20:29:59.547Z
closed_at: 2026-08-11T20:29:59.546Z
close_reason: The 10,001-issue boundary regression proves the 10,000-row hard response ceiling and full truncation count.
---
Final scale review found that the rewritten performance test proves exactly 10,000 rows are accepted but no longer exercises an over-limit source set. Use a 10,001-issue fixture (or equivalent boundary coverage) and assert the response returns exactly MAX_BOARD_ROWS while truncated reports the unsliced 10,001 count, preserving the hard-ceiling contract without weakening the 10k payload/time benchmark.

## Notes

Implemented in tests/performance.test.ts. The fixture now loads MAX_BOARD_ROWS + 1 issues, asserts exactly 10,000 returned rows, asserts truncated and total retain 10,001, excludes descriptions, and holds the <1s / <5 MiB budgets. Focused result: 11.45-18.10 ms load, 33.57-37.65 ms response build, 2.47 MiB. Exact-tree pnpm run ci passed 110 files / 1,503 tests.
