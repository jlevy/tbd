---
type: is
id: is-01kg3fq74xtepfgcjyfh6kx67z
title: Implement repairWorktree() function
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fqbtg9y7a9w730n7hh4sa
  - type: blocks
    target: is-01kg3fqmvn9pzrvyjf5jt758hh
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:41:18.877Z
updated_at: 2026-03-09T16:12:33.224Z
closed_at: 2026-01-29T01:07:34.414Z
close_reason: Added repairWorktree() function to git.ts. Handles prunable (git worktree prune), corrupted (backup + remove), and missing states. Calls initWorktree() to recreate. Updated sync.ts to use it.
---
Add repairWorktree() to git.ts. Follows decision tree from spec Appendix E: prune if prunable, create from local/remote/orphan based on branch state. Uses existing initWorktree() after cleanup. Location: packages/tbd/src/file/git.ts
