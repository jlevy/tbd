---
type: is
id: is-01m2exkd842xgzf2hky9jezcfw
title: "f08 contract T2: old parser and schemas read candidate-written beads, link records, and config"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies:
  - type: blocks
    target: is-01m1yzxaq89j76rrca4yb48ww2
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-14T02:58:05.698Z
updated_at: 2026-09-14T02:59:04.350Z
---
f08 compatibility contract, test T2. Nothing today proves that an old client reads what the candidate writes: setup never writes beads, so the byte comparison around setup (validate-upgrade-package.mjs:230-245) never exercises bead files, bridge link records, or config written by sync paths.

In the upgrade harness, import the baseline's exported parser and schemas (0.8.1 dist/index.mjs; 0.7.0 re-exports them from src/index.ts:19-23) and round-trip candidate-written beads (including descriptions containing a `## Notes` line, notes present and absent), link records (BridgeBaseSchema and LinkRecordSchema strip undeclared fields), and config. Assert identical parse results and an unchanged description hash. Gates tbd-w1kd and any change to bridge-record contents.
