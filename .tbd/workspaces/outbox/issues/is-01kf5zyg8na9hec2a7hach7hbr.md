---
close_reason: "Verified: Phase 22 ID preservation implemented"
closed_at: 2026-01-17T09:52:11.434Z
created_at: 2026-01-17T06:04:14.730Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.634Z
    original_id: tbd-1870
id: is-01kf5zyg8na9hec2a7hach7hbr
kind: task
labels:
  - phase-22
parent_id: null
priority: 2
status: closed
title: Update import.ts to preserve original Beads IDs
type: is
updated_at: 2026-03-09T16:12:30.203Z
version: 6
---
Modify import code to extract short ID from beads ID (e.g., '100' from 'tbd-100') and use it directly in ids.yml instead of generating a random 4-char base36 ID.
