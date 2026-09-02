---
type: is
id: is-01m1hzms1t9k57h7mdyj41cy26
title: "PR #264 review R2: web board reads the clock twice per response"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m1hzmrdcgkf45b2nf8mhqghq
created_at: 2026-09-02T21:15:49.177Z
updated_at: 2026-09-02T21:43:54.035Z
closed_at: 2026-09-02T21:43:54.033Z
close_reason: "Fixed in c1235d3c on PR #264; disposition map posted as issuecomment-5516854053."
resolution: null
duplicate_of: null
---
board.ts:942 and :1109 vs issue-query.ts:111. Cached snapshot.readyIds drives the row marker; the Ready filter recomputes fresh. They disagree once a deferral elapses while tbd web is up.
