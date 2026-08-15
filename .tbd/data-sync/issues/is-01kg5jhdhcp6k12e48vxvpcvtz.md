---
type: is
id: is-01kg5jhdhcp6k12e48vxvpcvtz
title: "Phase 4: Remove docs --refresh command"
kind: task
status: closed
priority: 2
version: 19
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhe5v1zx94azhqn57bnzq
  - type: blocks
    target: is-01kg5jhee3nrrtkqa80h52p1d8
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:03.403Z
updated_at: 2026-08-15T05:33:39.729Z
closed_at: 2026-08-15T05:33:39.729Z
close_reason: Completed specs are in docs/project/specs/done and their implementations, documentation, and tests ship on main.
extensions:
  linear:
    id: 9e24a12c-4882-4672-a917-7f0f8bfef9cb
    key: TBD-49
    url: https://linear.app/finterm-ai/issue/TBD-49/phase-4-remove-docs-refresh-command
    linked_at: 2026-08-10T19:36:23.062Z
    comments: null
---
Update docs.ts to:
- Remove --refresh option
- Remove --status option (moved to sync command)
- Remove handleRefresh() and handleStatus() methods
- Update help text
