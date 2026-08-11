---
type: is
id: is-01kzs5fg2amah8bnpy3mct8khd
title: "Spike: benchmark and raise the tbd web board scale ceiling"
kind: task
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - performance
  - pr-207
dependencies: []
parent_id: is-01kzrs779s8d2t4qmvpx310p22
created_at: 2026-08-11T19:41:04.969Z
updated_at: 2026-08-11T19:41:10.369Z
---
Measure the actual end-to-end costs of 4,000, 5,000, and 10,000 board rows: BoardState selection/tree ordering, JSON serialization and payload bytes, browser JSON parsing, DOM construction, layout/paint, repeated refresh, and expansion behavior. Replace the misleading server-only 5,000-issue benchmark with a file- and function-level acceptance model, then raise MAX_BOARD_ROWS to the highest default that remains responsive and resource-bounded. Preserve the existing BoardResponse API shape; this is an additive capacity increase with no file-format or schema change.

## Notes

File/function map started. Current cap: packages/tbd/src/cli/web/board.ts MAX_BOARD_ROWS/buildBoardResponse. Current benchmark: packages/tbd/tests/performance.test.ts web board case; it measures reload and response construction only, despite calling the latter rendered. Browser cost seams: packages/tbd/src/web/client.ts renderRow/renderBoard/render plus ClientStore detail queue in src/web/core.ts. Backward compatibility: preserve BoardResponse and API fields; only increase capacity and add safeguards/evidence.
