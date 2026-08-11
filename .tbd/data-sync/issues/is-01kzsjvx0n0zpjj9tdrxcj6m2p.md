---
type: is
id: is-01kzsjvx0n0zpjj9tdrxcj6m2p
title: Reconcile expanded rows across display-ID remaps
kind: bug
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - client-state
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:35:02.932Z
updated_at: 2026-08-11T23:40:53.534Z
---
PR review thread PRRT_kwDOQ109P86YZ9Vd found that BoardState correctly reports display-ID remaps as movement, but the browser retains expanded/body state under obsolete IDs and refetches those IDs before the canonical board arrives. Reconcile expanded rows by stable internalId when the accepted board crosses a graph version, drop vanished/hidden stale entries, and start replacement body requests only after canonical rows identify their current display IDs. Add a regression and document as R23.

## Notes

Validated the R23 implementation locally. Store.receiveState now invalidates body generation and defers expanded-row reload; Store.runRefreshLoop reconciles the last visible display ids to the accepted canonical board by stable internalId, drops rows no longer visible, and only then loads current body ids. The regression proves the exact request sequence web-one then next-one with no obsolete post-motion fetch. Focused web-core/web-board: 24/24. Formatting, Flowmark, strict dual TypeScript typecheck, zero-warning lint, build, and full pnpm run ci: 109 files / 1,508 tests green. Commit, hosted matrix, thread resolution, and final exact-head audit remain.
