---
type: is
id: is-01kzrs7qw8qv2ynt64n9c2w0y6
title: "Phase 3.1: implement BoardState snapshot, query parsing, tree rows, and stats"
kind: task
status: closed
priority: 1
version: 7
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
updated_at: 2026-08-11T16:29:38.247Z
closed_at: 2026-08-11T16:29:38.246Z
close_reason: Implemented src/cli/web/board.ts BoardState with serialized snapshot reloads, id:version movement diffing, shared selectIssues/describeQuery semantics, tree context rows, light table payloads, on-demand validated bodies, shared stats/status, and four focused tests.
extensions:
  linear:
    id: 4adae182-5acd-4d67-9a95-b9ef4c625c27
    linked_at: 2026-08-11T16:24:44.568Z
    key: TBD-139
    url: https://linear.app/finterm-ai/issue/TBD-139/phase-31-implement-boardstate-snapshot-query-parsing-tree-rows-and
---
Create packages/tbd/src/cli/web/board.ts. Define BoardState and public response types; load/reload one in-memory issue snapshot; diff id+version into moved/removed ids and monotonic dataVersion; translate URLSearchParams to fully parsed IssueQuery; use selectIssues/describeQuery, readyIssueIds, buildIssueTree, and computeIssueStats; serve lightweight rows and on-demand bodies. Cover exact query parity, hierarchy/context rows, stats, payload exclusion, and diff behavior.

## Notes

Implementation started after Phase 2 gate. Red-first coverage will pin snapshot movement/versioning, query parity, hierarchy/context rows, light-row payload bounds, body lookup validation, served stats/status, and no-op reload stickiness.
