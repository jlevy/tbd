---
type: is
id: is-01kg5jhd1bprqhysw96b5genm0
title: "Phase 2: Update sync command with --issues/--docs flags"
kind: task
status: closed
priority: 2
version: 18
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhdhcp6k12e48vxvpcvtz
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:02.890Z
updated_at: 2026-08-15T05:33:39.717Z
closed_at: 2026-08-15T05:33:39.717Z
close_reason: Completed specs are in docs/project/specs/done and their implementations, documentation, and tests ship on main.
extensions:
  linear:
    id: 61a2f1fa-3a7d-46c0-a549-375e651ed8d8
    key: TBD-51
    url: https://linear.app/finterm-ai/issue/TBD-51/phase-2-update-sync-command-with-issues-docs-flags
    linked_at: 2026-08-10T19:36:21.458Z
    comments: null
---
Update sync.ts to:
- Add --issues and --docs flags
- Validate mutually exclusive flag combinations
- Call syncDocsWithDefaults() when syncing docs
- Update output to show both issue and doc results
- Update --status to show both statuses
