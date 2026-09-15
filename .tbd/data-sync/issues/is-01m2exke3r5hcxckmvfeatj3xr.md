---
type: is
id: is-01m2exke3r5hcxckmvfeatj3xr
title: "f08 contract T3: mixed-version Linear convergence between packed 0.8.1 and the candidate"
kind: task
status: open
priority: 1
version: 8
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
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-14T02:58:06.582Z
updated_at: 2026-09-15T22:48:25.204Z
---
f08 compatibility contract, test T3: mixed-version Linear convergence. Both 0.8.1 and the candidate honor LINEAR_API_URL (linear/client.ts:111), so a packed 0.8.1 client and the candidate can alternate `tbd integration sync` against the Linear mock server on one shared repository.

Scenarios: an open epic blocked by an open bead; an epic with a future deferred_until (main treats it as not ready since #264, 0.8.1 does not); an item in In Review; a team with no Backlog state; a #267 pair seeded by 0.8.1 (base duplicate, remote Canceled, bead with duplicate_of); a flattened deep child (1e); one 0.8.1 `--push` run in the middle. Assert both versions are quiet by run 4, no Linear state flips between Todo and Backlog, and no duplicate_of is lost.

Gates tbd-od0z, tbd-alws, tbd-4c5c, and the Phase 1B engine (tbd-6md1). If a scenario cannot converge with 0.8.1, the change ships with a stated minimum version for every clone that runs integration sync, or opt-in.

## Notes

2026-09-15 release-readiness review of main @ 1238038e: not started (validate-upgrade-package.mjs ~:745-748 defers it), and more urgent after #290. 0da306d5 notes a 0.8.1 clone still pushes Todo for not-ready work while the candidate writes Backlog. 0.8.1 readiness also ignores deferred_until (v0.8.1 issue-selection.ts:73 vs main :94), so a linked future-deferred bead flips Backlog/Todo each time the other clone syncs, and blocked epics may lock into pull-silent / push-noop alternation. Either land T3 or ship Release 1 with notes stating a minimum version for every clone that runs integration sync.

2026-09-15 (tbd-evn3 work, PR #293): measured against the Linear mock with the pre-#293 mirror, which is what a 0.8.1 `--push` sends. A blocked linked epic went: full sync (Backlog), `--push` (Todo), then full syncs 2 and 3 wrote nothing and left it in Todo, full sync 4 issued one IssueUpdate that moved it back to Backlog, and full sync 5 was quiet. So after one old-client `--push`, not-ready items stay in Todo for two new-client full syncs and return to Backlog on the third. The mechanism behind the two-run lag was not investigated. T3 should expect this sequence or explain it.
