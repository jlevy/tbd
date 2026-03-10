---
type: is
id: is-01kg5jhd1bprqhysw96b5genm0
title: "Phase 2: Update sync command with --issues/--docs flags"
kind: task
status: open
priority: 2
version: 7
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhdhcp6k12e48vxvpcvtz
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:02.890Z
updated_at: 2026-03-09T16:12:33.383Z
---
Update sync.ts to:
- Add --issues and --docs flags
- Validate mutually exclusive flag combinations
- Call syncDocsWithDefaults() when syncing docs
- Update output to show both issue and doc results
- Update --status to show both statuses
