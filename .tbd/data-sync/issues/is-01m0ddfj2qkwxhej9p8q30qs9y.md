---
type: is
id: is-01m0ddfj2qkwxhej9p8q30qs9y
title: Fall back to the main worktree .env in credential resolution
kind: task
status: open
priority: 0
version: 5
spec_path: null
assignee: josh
labels: []
dependencies:
  - type: blocks
    target: is-01m0ddfjd4q6zawvdwh008w9h2
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:44.278Z
updated_at: 2026-08-19T18:08:15.277Z
---
Wire the main-worktree helper into integration credential loading as layer 3 of the resolution order:

1. process environment
2. `./.env` in the current working tree
3. `<main-worktree>/.env`
4. not found

Layers 1 and 2 keep their current precedence, so an exported variable still wins and a worktree-local `.env` remains a deliberate per-worktree override. The fallback is read-only: nothing in setup or sync may write to the main worktree's `.env`.
