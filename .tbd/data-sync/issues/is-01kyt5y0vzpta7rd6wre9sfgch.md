---
type: is
id: is-01kyt5y0vzpta7rd6wre9sfgch
title: "PR #196 review N5: identical-endpoint report reads snapshot twice; ready sets computed unconditionally"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kyt5x6y2h4d3x7b68jjr6n2j
created_at: 2026-07-30T18:52:33.535Z
updated_at: 2026-07-30T19:12:33.307Z
closed_at: 2026-07-30T19:12:33.307Z
close_reason: "Fixed in f71b1cf on PR #196; CI green"
---
createChangesReportFromRefs reads the same snapshot twice when since===tip (sync-branch-changes.ts:295-298); readyIssueIds computed for selections that never use them (issue-changes.ts:395-396). PR #196
