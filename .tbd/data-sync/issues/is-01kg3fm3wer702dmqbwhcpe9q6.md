---
type: is
id: is-01kg3fm3wer702dmqbwhcpe9q6
title: Add checkRemoteBranchHealth() function
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
    target: is-01kg3fmneqw80andsyp2wpbnb8
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:37.229Z
updated_at: 2026-03-09T16:12:33.133Z
closed_at: 2026-01-28T23:55:44.527Z
close_reason: Added checkRemoteBranchHealth() function to git.ts
---
Add checkRemoteBranchHealth() to git.ts per spec. Returns { exists, diverged, head? }. Uses git fetch and merge-base to detect if remote tbd-sync exists and whether local/remote have diverged. Location: packages/tbd/src/file/git.ts
