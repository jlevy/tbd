---
type: is
id: is-01kjb6s8sc4b9cveaamzeasdxa
title: Support linked-worktree sync without branch checkout conflicts
kind: feature
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-02-25-multi-worktree-sync-branch-isolation.md
labels: []
dependencies: []
child_order_hints:
  - is-01kjb6sfnkwgfczq3nrmygn4js
created_at: 2026-02-25T20:10:28.011Z
updated_at: 2026-02-25T20:10:35.058Z
---
Implement per-checkout local sync branches while keeping origin/tbd-sync canonical to avoid inner worktree branch lock failures in AI linked-worktree environments.
