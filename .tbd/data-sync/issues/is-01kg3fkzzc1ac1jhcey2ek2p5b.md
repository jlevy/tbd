---
type: is
id: is-01kg3fkzzc1ac1jhcey2ek2p5b
title: Add checkLocalBranchHealth() function
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fm8whz13k1ty2st7461m0
  - type: blocks
    target: is-01kg3fmhfsnrs2mpsqx7gb4c3y
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:33.228Z
updated_at: 2026-03-09T16:12:33.127Z
closed_at: 2026-01-28T23:55:19.720Z
close_reason: Added checkLocalBranchHealth() function to git.ts
---
Add checkLocalBranchHealth() to git.ts per spec. Returns { exists, orphaned, head? }. Uses git rev-parse and git show-ref to check if tbd-sync branch exists and has commits. Location: packages/tbd/src/file/git.ts
