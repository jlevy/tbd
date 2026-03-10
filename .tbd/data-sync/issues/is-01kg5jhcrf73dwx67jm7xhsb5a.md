---
type: is
id: is-01kg5jhcrf73dwx67jm7xhsb5a
title: "Phase 1: Extract shared syncDocsWithDefaults() function"
kind: task
status: open
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhd1bprqhysw96b5genm0
  - type: blocks
    target: is-01kg5jhd9dbyg3k2c5j8seahk5
  - type: blocks
    target: is-01kg5jhdtwzxw7ce1xvnnc5tn3
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:02.601Z
updated_at: 2026-03-09T16:12:33.377Z
---
Create syncDocsWithDefaults() in doc-sync.ts with:
- Merge defaults from bundled docs
- pruneStaleInternals() helper to remove missing internal sources
- Config comparison and conditional write
- Unit tests for new functions
