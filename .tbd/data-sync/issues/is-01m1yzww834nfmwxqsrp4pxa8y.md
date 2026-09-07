---
type: is
id: is-01m1yzww834nfmwxqsrp4pxa8y
title: "Convergence contract: excluded items never hold nothingToDo false"
kind: bug
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m1yzwxwh17mdy5dbk1mkvgxw
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:22.210Z
updated_at: 2026-09-07T22:31:40.699Z
---
GH #272. skippedOutbound (beads past max_nesting) is a term in both nothingToDo computations (sync-engine.ts:1076 and :1678-1692); it is recomputed from the graph every run and nothing but re-parenting or a policy change can clear it, so one deep bead means nothing-to-do is never reached. Define the report classes actionable / suppressed / excluded / failed / blocked (plan 1a). Excluded = standing conditions: past max_nesting, a field push the provider or user_map cannot carry (capability-limited skippedPushes), importable items under inbound.mode: report. nothingToDo is true when actionable, suppressed and failed are empty; excluded is reported every run and never counts. Red-green: a second runSync over an unchanged deep bead reports nothingToDo true and lists the bead as excluded (beside tests/integrations-sync-engine.test.ts:693).
