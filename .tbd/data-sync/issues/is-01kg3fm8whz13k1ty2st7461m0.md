---
type: is
id: is-01kg3fm8whz13k1ty2st7461m0
title: Add checkSyncConsistency() function
kind: task
status: closed
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fmsr4tvm52tb3xc3kyf1a
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:42.352Z
updated_at: 2026-03-09T16:12:33.138Z
closed_at: 2026-01-29T00:36:33.306Z
close_reason: Added checkSyncConsistency() function to git.ts - compares worktree/local/remote HEADs and calculates ahead/behind counts
---
Add checkSyncConsistency() to git.ts per spec. Returns { worktreeHead, localHead, remoteHead, worktreeMatchesLocal, localAhead, localBehind }. Compares worktree HEAD with local branch and tracks ahead/behind counts vs remote. Location: packages/tbd/src/file/git.ts
