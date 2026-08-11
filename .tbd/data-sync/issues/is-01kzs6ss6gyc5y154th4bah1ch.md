---
type: is
id: is-01kzs6ss6gyc5y154th4bah1ch
title: Bound web detail and deletion-state memory at 10k scale
kind: bug
status: closed
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - performance
  - pr-207
dependencies: []
parent_id: is-01kzs5fg2amah8bnpy3mct8khd
created_at: 2026-08-11T20:04:10.575Z
updated_at: 2026-08-11T20:29:59.299Z
closed_at: 2026-08-11T20:29:59.298Z
close_reason: Scale-specific expansion, body-cache, deletion-ghost, and row-classification paths are bounded and fully tested.
---
Fresh 10k review finding: browser pagination bounds steady-state board rows, but Store.receiveState can still expose every removed row as a ghost after a mass deletion, and loaded bead bodies remain cached without a ceiling across navigation. Cap ghost animation rows, cap simultaneous expanded details, bound the body cache with collapsed-entry eviction, retain eight-request concurrency, and replace per-row Array.includes membership checks with render-local sets. Cover each bound in web-core tests.

## Notes

Implemented and fully validated. src/web/core.ts bounds expanded details at 100, cached bodies at 200, and deletion ghosts at 100 while retaining the eight-request concurrency limit; toggle rolls the oldest expansion forward at the bound. src/web/client.ts uses render-local sets, frame-coalesced paints, and a shared bulk-expansion guard. web-core regressions cover all bounds. Exact-tree pnpm run ci passed 110 files / 1,503 tests, and the packed web artifact proof passed.
