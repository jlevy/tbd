---
type: is
id: is-01m01ec5zrek6jvw1ssmdgn6qz
title: Handle missing origin/tbd-sync in single-branch clones
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
created_at: 2026-08-15T00:50:28.982Z
updated_at: 2026-08-28T19:55:36.112Z
---
In a fresh clone created with --branch main --single-branch, origin/tbd-sync exists on the server but its remote-tracking ref is absent locally. The first tbd create attempts git worktree add -b tbd-sync ... origin/tbd-sync and fails with 'invalid reference: origin/tbd-sync'. tbd should fetch or otherwise discover the remote sync branch before creating its worktree. Reproduced with tbd 0.6.5 while testing the jlevy/tryscript upgrade.
