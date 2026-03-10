---
type: is
id: is-01kg3fpgdvx6b4e21wwgnnrtqh
title: Update resolveDataSyncDir() to throw WorktreeMissingError
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fpmwcq4y6y7wa7yvzd8p3
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:40:55.610Z
updated_at: 2026-03-09T16:12:33.207Z
closed_at: 2026-01-29T00:48:35.446Z
close_reason: Added allowFallback option to resolveDataSyncDir()
---
Fix Bug 3: resolveDataSyncDir() silently falls back to .tbd/data-sync/ when worktree missing. Change to throw WorktreeMissingError in production. Add options { allowFallback?: boolean; repair?: boolean } per spec. Only allow fallback in test mode. Location: packages/tbd/src/lib/paths.ts:225-246
