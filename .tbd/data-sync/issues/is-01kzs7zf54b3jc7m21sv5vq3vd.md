---
type: is
id: is-01kzs7zf54b3jc7m21sv5vq3vd
title: Bound pretty-tree context metadata to returned web rows
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
created_at: 2026-08-11T20:24:45.475Z
updated_at: 2026-08-11T20:29:59.794Z
closed_at: 2026-08-11T20:29:59.793Z
close_reason: Pretty-tree context metadata is now bounded to returned rows with an over-limit hierarchy regression.
---
Final 10k review found BoardState.buildBoardResponse slices rows to MAX_BOARD_ROWS after computing contextIds across the full pretty-tree result. An oversized filtered hierarchy can therefore serialize context IDs for rows the client never receives, inflate the response outside the intended row bound, and overstate contextCount. Derive contextIds/contextCount from the sliced response rows and add an over-limit pretty-tree regression proving every context ID names a returned row.

## Notes

Implemented in BoardState.buildBoardResponse: responseRows is sliced first, then contextIds and contextCount are derived only from IDs present in that slice. web-board.test.ts builds an over-limit shallow pretty hierarchy and proves every context ID names a returned row, the row cap is exact, and truncation retains the full row count. Exact-tree pnpm run ci passed 110 files / 1,503 tests.
