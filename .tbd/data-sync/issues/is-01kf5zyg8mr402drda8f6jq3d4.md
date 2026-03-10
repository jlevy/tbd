---
type: is
id: is-01kf5zyg8mr402drda8f6jq3d4
title: Fix command injection in git.ts
kind: task
status: closed
priority: 0
version: 6
labels:
  - phase-14
  - security
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-15T21:10:01.000Z
updated_at: 2026-03-09T16:12:30.036Z
closed_at: 2026-01-16T21:55:33.004Z
close_reason: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.076Z
    original_id: tbd-1501
---
Changed exec to execFile to prevent shell injection attacks in git command execution.
