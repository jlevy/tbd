---
type: is
id: is-01m1hzmrqthny8wvchb9sgvw0b
title: "PR #264 review R1: hidden Date.now() in the pure issue-changes module"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m1hzmrdcgkf45b2nf8mhqghq
created_at: 2026-09-02T21:15:48.857Z
updated_at: 2026-09-02T21:43:53.697Z
closed_at: 2026-09-02T21:43:53.696Z
close_reason: "Fixed in c1235d3c on PR #264; disposition map posted as issuecomment-5516854053."
resolution: null
duplicate_of: null
---
issue-changes.ts:448. Module header claims pure/deterministic. Thread a required readyAt through CreateIssueChangesReportOptions; pass from sync-branch-changes.ts:357 and board.ts:993 (which already has dependencies.now()).
