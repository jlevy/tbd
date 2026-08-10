---
type: is
id: is-01kzn489msh2ftac9rzrade7n1
title: "PR #205 final R1: preserve empty-status list behavior"
kind: bug
status: in_progress
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kzn47zwk7319adecbtgm3n3p
created_at: 2026-08-10T06:02:42.712Z
updated_at: 2026-08-10T06:04:29.651Z
---
Review finding R1 at issuecomment-5236448534: packages/tbd/src/cli/commands/list.ts changed tbd list --status with an empty value from no filter to no matches. Restore the pre-PR behavior and add a regression test.
