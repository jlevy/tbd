---
close_reason: "Verified: Phase 22 ID preservation implemented"
closed_at: 2026-01-17T09:52:11.434Z
created_at: 2026-01-17T06:04:09.132Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.627Z
    original_id: tbd-1869
id: is-01kf5zyg8nskjn09vz2hfcnz6j
kind: task
labels:
  - phase-22
parent_id: null
priority: 2
status: closed
title: Update ShortId schema validation to allow 1+ chars
type: is
updated_at: 2026-03-09T02:47:21.505Z
version: 5
---
Change validateShortId() regex from /^[0-9a-z]{4,5}$/ to /^[0-9a-z]+$/ to allow imported IDs of any length (e.g., '1', '100', '1823').
