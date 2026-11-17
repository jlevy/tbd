---
type: is
id: is-01m6yyrkn8xkdbg0dt48rnbn85
title: "PR #334 A1: fixture test fails on Windows CI (CRLF checkout)"
kind: bug
status: closed
priority: 0
version: 2
labels: []
dependencies: []
parent_id: is-01m6yyrk941gackncya2evk0t8
created_at: 2026-11-09T01:29:02.888Z
updated_at: 2026-11-09T01:46:28.002Z
closed_at: 2026-11-09T01:46:28.002Z
close_reason: Fixed in 3c427f6c; Windows CI job 128930401447 passes
resolution: null
duplicate_of: null
---
Blocker. tests/agents-md-block.test.ts compares LF output with a CRLF-checked-out fixture. Review A on https://github.com/jlevy/tbd/pull/334
