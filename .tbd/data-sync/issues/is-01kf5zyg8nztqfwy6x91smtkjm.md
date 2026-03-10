---
type: is
id: is-01kf5zyg8nztqfwy6x91smtkjm
title: Re-import existing beads data with preserved IDs
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
created_at: 2026-01-17T06:04:31.497Z
updated_at: 2026-03-09T16:12:30.382Z
closed_at: 2026-01-17T09:52:11.434Z
close_reason: Skipped - optional manual step. ID preservation verified working via golden tests.
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.655Z
    original_id: tbd-1873
---
Delete existing .tbd data (rm -rf .tbd/ except config), run fresh import with ID preservation. Verify all tbd-* IDs are preserved (bd-100 not bd-xxxx). Delete obsolete beads.yml.
