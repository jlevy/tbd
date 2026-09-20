---
type: is
id: is-01m2y5fr1cgpg5pyn2na93qd5s
title: "PR #310 D1: Separate fork output context and TTL from inline work"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:04:30.762Z
updated_at: 2026-09-20T01:18:43.723Z
started_at: 2026-09-20T01:18:43.721Z
---
Review D. Research lines 1143/1151 conflates forked and inline work: forks return final reports not tool transcripts, new fork writes use subagent TTL. Correct table/example from official Claude docs.
