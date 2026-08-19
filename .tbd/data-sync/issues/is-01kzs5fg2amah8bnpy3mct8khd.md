---
type: is
id: is-01kzs5fg2amah8bnpy3mct8khd
title: "Spike: benchmark and raise the tbd web board scale ceiling"
kind: task
status: closed
priority: 1
version: 11
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - performance
  - pr-207
dependencies: []
parent_id: is-01kzrs779s8d2t4qmvpx310p22
child_order_hints:
  - is-01kzs6ss6gyc5y154th4bah1ch
  - is-01kzs7w3snkv7gt9dwqdrspeew
  - is-01kzs7zf54b3jc7m21sv5vq3vd
  - is-01kzs9hy1f971yzj995exw09gd
created_at: 2026-08-11T19:41:04.969Z
updated_at: 2026-08-11T21:05:48.985Z
closed_at: 2026-08-11T21:05:48.984Z
close_reason: 10,000-row paged ceiling selected from measured browser/server bounds and all four scale findings are closed.
---
Measure the actual end-to-end costs of 4,000, 5,000, and 10,000 board rows: BoardState selection/tree ordering, JSON serialization and payload bytes, browser JSON parsing, DOM construction, layout/paint, repeated refresh, and expansion behavior. Replace the misleading server-only 5,000-issue benchmark with a file- and function-level acceptance model, then raise MAX_BOARD_ROWS to the highest default that remains responsive and resource-bounded. Preserve the existing BoardResponse API shape; this is an additive capacity increase with no file-format or schema change.

## Notes

Decision complete: serve at most 10,000 rows while independently bounding browser work. Old full DOM measured 4k at 42,861 nodes / 0.71-0.88s, 5k at 53,528 / 0.86-1.00s, and 10k at 106,861 / 1.69-1.83s; old expand-all reached 156,861 nodes / 3.89s. Final design paints 1,000-row pages, permits 100 open details, caches 200 bodies, animates 100 deletion ghosts, and keeps eight detail requests in flight. Warm Chromium paint-ready is 0.17-0.20s with 10,870 nodes at every measured scale. The 10,001 boundary returns 10,000 rows in 18.10ms load / 37.65ms build and 2.47 MiB under full-suite contention. Children tbd-z3o9, tbd-et3a, tbd-6pjo, and tbd-wmdo are closed. Exact-tree CI passes 110 files / 1,503 tests; hosted run 31535582219 is green.
