---
type: is
id: is-01m1yzx01dbhsas1c08k34d4e2
title: Blocked or failing fold prints pending counts and every failure; remedy names the invoked command
kind: bug
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:26.089Z
updated_at: 2026-09-16T08:24:08.568Z
extensions:
  linear:
    id: 38a3db43-24ee-4221-be54-ad5e7c4815ce
    linked_at: 2026-09-16T08:24:08.568Z
---
GH #276. reports is declared inside the try in the fold (sync.ts:1231-1243) and is out of scope in the catch (:1248-1254), so the warning carries only the error message; assertIntegrationReportsHealthy names only the first failure (:396-414). The bulk guard refuses before any item is attempted (sync-engine.ts:1008-1020, bulk-guard.ts:34-62) and its remedy says 'Re-run with --yes', a flag tbd sync does not have. Hoist reports; make the threshold refusal a typed error carrying the planned counts; print 'linear: blocked by the bulk threshold: 174 updates (limit 40); pending push 174, pull 1' with the remedy for the command actually invoked (bulk-guard takes the command name); list every failure when items fail.

Revision 2026-09-13 (plan review against main and PRs #278-#283): Also: the engine's bulk guard runs after journal replay (sync-engine.ts:435 vs :1009-1020), so a refused run may already have written replayed intents; move replay after the guard or count replayed intents toward it. The '174 updates' refusal in #276 came from the mirror's separate guard (integration-runner.ts:423-439), which counts unchanged items; Phase 1B removes it, and tbd-mjb7 labels it in the interim.
