---
type: is
id: is-01m2exke3r5hcxckmvfeatj3xr
title: "f08 contract T3: mixed-version Linear convergence between packed 0.8.1 and the candidate"
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies:
  - type: blocks
    target: is-01m1yzx83jc1eyn522mxfg5cc1
  - type: blocks
    target: is-01m1yzx6mfhcc6px4p5xdnvxch
  - type: blocks
    target: is-01m1yzx57t4174xcg4fydgqrw9
  - type: blocks
    target: is-01m2egwz6r0qgbtvzh2nkevjdb
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-14T02:58:06.582Z
updated_at: 2026-09-14T02:59:03.427Z
---
f08 compatibility contract, test T3: mixed-version Linear convergence. Both 0.8.1 and the candidate honor LINEAR_API_URL (linear/client.ts:111), so a packed 0.8.1 client and the candidate can alternate `tbd integration sync` against the Linear mock server on one shared repository.

Scenarios: an open epic blocked by an open bead; an epic with a future deferred_until (main treats it as not ready since #264, 0.8.1 does not); an item in In Review; a team with no Backlog state; a #267 pair seeded by 0.8.1 (base duplicate, remote Canceled, bead with duplicate_of); a flattened deep child (1e); one 0.8.1 `--push` run in the middle. Assert both versions are quiet by run 4, no Linear state flips between Todo and Backlog, and no duplicate_of is lost.

Gates tbd-od0z, tbd-alws, tbd-4c5c, and the Phase 1B engine (tbd-6md1). If a scenario cannot converge with 0.8.1, the change ships with a stated minimum version for every clone that runs integration sync, or opt-in.
