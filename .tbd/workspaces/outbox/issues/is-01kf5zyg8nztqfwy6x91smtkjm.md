---
close_reason: Skipped - optional manual step. ID preservation verified working via golden tests.
closed_at: 2026-01-17T09:52:11.434Z
created_at: 2026-01-17T06:04:31.497Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.655Z
    original_id: tbd-1873
id: is-01kf5zyg8nztqfwy6x91smtkjm
kind: task
labels:
  - phase-22
parent_id: null
priority: 2
status: closed
title: Re-import existing beads data with preserved IDs
type: is
updated_at: 2026-03-09T16:12:30.382Z
version: 6
---
Delete existing .tbd data (rm -rf .tbd/ except config), run fresh import with ID preservation. Verify all tbd-* IDs are preserved (bd-100 not bd-xxxx). Delete obsolete beads.yml.
