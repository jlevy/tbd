---
close_reason: Used formatDisplayId to show truncated 6-char IDs instead of full ULIDs
closed_at: 2026-01-16T19:13:38.305Z
created_at: 2026-01-16T07:07:22.036Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.207Z
    original_id: tbd-1811
id: is-01kf5zyg8mc5apjjbzchfxpfam
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "Bug: list command shows internal ULID IDs instead of short public IDs"
type: is
updated_at: 2026-03-09T02:47:21.050Z
version: 5
---
The list command shows internal ULID-based IDs like 'bd-01kf2sp62c0dhqcwahs6ah5k92' instead of short public IDs. Current code just strips 'is-' prefix and adds 'bd-'. Should use ID mapping file for short IDs (e.g., 'bd-a7k2') and for beads imports, preserve original IDs from extensions.beads.original_id (e.g., 'tbd-401').
