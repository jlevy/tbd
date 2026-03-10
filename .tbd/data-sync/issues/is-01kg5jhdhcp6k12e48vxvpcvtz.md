---
type: is
id: is-01kg5jhdhcp6k12e48vxvpcvtz
title: "Phase 4: Remove docs --refresh command"
kind: task
status: open
priority: 2
version: 8
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg5jhe5v1zx94azhqn57bnzq
  - type: blocks
    target: is-01kg5jhee3nrrtkqa80h52p1d8
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:03.403Z
updated_at: 2026-03-09T16:12:33.395Z
---
Update docs.ts to:
- Remove --refresh option
- Remove --status option (moved to sync command)
- Remove handleRefresh() and handleStatus() methods
- Update help text
