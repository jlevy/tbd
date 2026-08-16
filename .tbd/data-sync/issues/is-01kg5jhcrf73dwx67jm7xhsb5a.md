---
type: is
id: is-01kg5jhcrf73dwx67jm7xhsb5a
title: "Phase 1: Extract shared syncDocsWithDefaults() function"
kind: task
status: closed
priority: 2
version: 20
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
updated_at: 2026-08-15T05:33:39.710Z
closed_at: 2026-08-15T05:33:39.710Z
close_reason: Completed specs are in docs/project/specs/done and their implementations, documentation, and tests ship on main.
extensions:
  linear:
    id: b3fc13b3-ecc2-468c-b5fb-2df336e72f44
    key: TBD-52
    url: https://linear.app/finterm-ai/issue/TBD-52/phase-1-extract-shared-syncdocswithdefaults-function
    linked_at: 2026-08-10T19:36:20.429Z
    comments: null
---
Create syncDocsWithDefaults() in doc-sync.ts with:
- Merge defaults from bundled docs
- pruneStaleInternals() helper to remove missing internal sources
- Config comparison and conditional write
- Unit tests for new functions
