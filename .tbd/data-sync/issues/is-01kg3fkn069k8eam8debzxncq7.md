---
type: is
id: is-01kg3fkn069k8eam8debzxncq7
title: Add WorktreeMissingError, WorktreeCorruptedError, SyncBranchError classes
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fkv48kzhzq6e86z0hm3p0
  - type: blocks
    target: is-01kg3fpgdvx6b4e21wwgnnrtqh
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:21.989Z
updated_at: 2026-03-09T16:12:33.117Z
closed_at: 2026-01-28T23:54:43.081Z
close_reason: Added WorktreeMissingError, WorktreeCorruptedError, SyncBranchError classes to errors.ts
---
Add error classes to errors.ts per spec design. WorktreeMissingError for missing worktree, WorktreeCorruptedError for invalid worktree, SyncBranchError for sync branch issues. Location: packages/tbd/src/cli/lib/errors.ts
