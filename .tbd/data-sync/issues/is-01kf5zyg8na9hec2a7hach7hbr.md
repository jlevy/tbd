---
type: is
id: is-01kf5zyg8na9hec2a7hach7hbr
title: Update import.ts to preserve original Beads IDs
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
created_at: 2026-01-17T06:04:14.730Z
updated_at: 2026-03-09T16:12:30.203Z
closed_at: 2026-01-17T09:52:11.434Z
close_reason: "Verified: Phase 22 ID preservation implemented"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.634Z
    original_id: tbd-1870
---
Modify import code to extract short ID from beads ID (e.g., '100' from 'tbd-100') and use it directly in ids.yml instead of generating a random 4-char base36 ID.
