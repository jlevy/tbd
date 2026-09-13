---
type: is
id: is-01m2egwz6r0qgbtvzh2nkevjdb
title: "One sync planner: --push and --pull filter one plan; base advances per applied field"
kind: feature
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m2egx23y90sxzkrbnc1tyd5k
  - type: blocks
    target: is-01m2egx4gsnz7t61bpdvpcpqhw
  - type: blocks
    target: is-01m2egx69q1wdj3p0tccxdkgg7
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:07.511Z
updated_at: 2026-09-13T23:18:40.996Z
---
Implements tbd-dqiq option (a). One planner, planSync(scope), returns classified actions (push, pull, create, import, block splice, attachment refresh, parent, comment, conflict, replayed intent) plus the excluded/suppressed/failed/blocked classes from 1b. `--push` applies outbound kinds and `--pull` inbound kinds; the rest is reported as suppressed. The base advances per field for what was applied, replacing the whole-record rule at sync-engine.ts:1433-1472. One bulk guard over the filtered actions before any write; one printer; one JSON report type. `tbd sync --push/--pull --integrations` become the same filters, and `tbd sync --integrations` runs after the git merge (integration-runner.ts:5-10).

Tests: property that the --push and --pull plans are disjoint subsets of the bare plan for any state; a push-only run does not advance the base of a field it did not write.
