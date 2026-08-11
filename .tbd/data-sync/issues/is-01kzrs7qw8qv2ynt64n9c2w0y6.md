---
type: is
id: is-01kzrs7qw8qv2ynt64n9c2w0y6
title: "Phase 3.1: implement BoardState snapshot, query parsing, tree rows, and stats"
kind: task
status: in_progress
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - server
  - web
dependencies:
  - type: blocks
    target: is-01kzrs7yrc2hjjks6qc38mhc2y
  - type: blocks
    target: is-01kzrs87qg5tssg8p41wpj3kwj
  - type: blocks
    target: is-01kzrs8yftzrvng3a16fs26hm1
parent_id: is-01kzrs66v8et3vwh2tpmk3v9d9
created_at: 2026-08-11T16:07:07.911Z
updated_at: 2026-08-11T16:20:47.949Z
---
Create packages/tbd/src/cli/web/board.ts. Define BoardState and public response types; load/reload one in-memory issue snapshot; diff id+version into moved/removed ids and monotonic dataVersion; translate URLSearchParams to fully parsed IssueQuery; use selectIssues/describeQuery, readyIssueIds, buildIssueTree, and computeIssueStats; serve lightweight rows and on-demand bodies. Cover exact query parity, hierarchy/context rows, stats, payload exclusion, and diff behavior.

## Notes

Implementation started after Phase 2 gate. Red-first coverage will pin snapshot movement/versioning, query parity, hierarchy/context rows, light-row payload bounds, body lookup validation, served stats/status, and no-op reload stickiness.
