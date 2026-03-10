---
type: is
id: is-01kf5zyg8nskjn09vz2hfcnz6j
title: Update ShortId schema validation to allow 1+ chars
kind: task
status: closed
priority: 2
version: 6
labels:
  - phase-22
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T06:04:09.132Z
updated_at: 2026-03-09T16:12:30.338Z
closed_at: 2026-01-17T09:52:11.434Z
close_reason: "Verified: Phase 22 ID preservation implemented"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.627Z
    original_id: tbd-1869
---
Change validateShortId() regex from /^[0-9a-z]{4,5}$/ to /^[0-9a-z]+$/ to allow imported IDs of any length (e.g., '1', '100', '1823').
