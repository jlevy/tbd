---
type: is
id: is-01m1yzwsqz1fcgc03e0mck82tn
title: "Land the 2026-08-28 stability branch: rebase claude/tbd-sync-bugs-review-f1qb1f onto main and merge"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies:
  - type: blocks
    target: is-01m1yzwv5hxya72fgnk91pb3gv
  - type: blocks
    target: is-01m1yzx83jc1eyn522mxfg5cc1
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:19.640Z
updated_at: 2026-09-07T22:31:39.092Z
---
Three commits (4d23edcf, ed45804a, 936909fe), seven files, +785/-9: the spec plan-2026-08-28-sync-convergence-and-stability.md plus tbd-10zb, tbd-p40p, tbd-8gcz, tbd-r1a3, tbd-aypl (--explain) and the mock stateId fix. git merge-tree against origin/main reports no conflicts; main is 7 commits ahead. Rebase, run tests/integrations-sync-engine.test.ts, tests/integration-cli-e2e.test.ts and the cli-sync* tryscripts, open the PR, merge. Landing the spec file also stops its 31 beads reading as dangling.
