---
close_reason: null
closed_at: 2026-01-16T21:55:33.004Z
created_at: 2026-01-15T21:10:01.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.076Z
    original_id: tbd-1501
id: is-01kf5zyg8mr402drda8f6jq3d4
kind: task
labels:
  - phase-14
  - security
parent_id: null
priority: 0
status: closed
title: Fix command injection in git.ts
type: is
updated_at: 2026-03-09T02:47:21.189Z
version: 5
---
Changed exec to execFile to prevent shell injection attacks in git command execution.
