---
type: is
id: is-01kzs5fg2amah8bnpy3mct8khd
title: "Spike: benchmark and raise the tbd web board scale ceiling"
kind: task
status: in_progress
priority: 1
version: 8
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
created_at: 2026-08-11T19:41:04.969Z
updated_at: 2026-08-11T20:30:15.931Z
---
Measure the actual end-to-end costs of 4,000, 5,000, and 10,000 board rows: BoardState selection/tree ordering, JSON serialization and payload bytes, browser JSON parsing, DOM construction, layout/paint, repeated refresh, and expansion behavior. Replace the misleading server-only 5,000-issue benchmark with a file- and function-level acceptance model, then raise MAX_BOARD_ROWS to the highest default that remains responsive and resource-bounded. Preserve the existing BoardResponse API shape; this is an additive capacity increase with no file-format or schema change.

## Notes

Decision: 10,000 served rows with independent browser resource ceilings, not a 10,000-row DOM. Old full DOM measured 4k at 42,861 nodes / 0.71-0.88s, 5k at 53,528 / 0.86-1.00s, and 10k at 106,861 / 1.69-1.83s; old expand-all reached 156,861 nodes / 3.89s before detail completions. Final design serves 10k, paints 1,000-row pages, permits 100 open details, caches 200 bodies, animates 100 deletion ghosts, and keeps eight detail requests in flight. Warm Chromium paint-ready was 0.17-0.20s with 10,870 nodes at 4k/5k/10k. Server boundary fixture returns 10,000 of 10,001 in 18.10ms load / 37.65ms build and 2.47 MiB under full-suite contention. Pretty-tree context metadata is constrained to returned rows. Exact-tree pnpm run ci passed 110 files / 1,503 tests; tryscript 1,074, publint, 31 package-age pins, watch-release, and packed-web proof are green. Child findings tbd-z3o9, tbd-et3a, and tbd-6pjo are closed. Awaiting pushed-head GitHub matrix and final PR disposition before closing this landing bead.
