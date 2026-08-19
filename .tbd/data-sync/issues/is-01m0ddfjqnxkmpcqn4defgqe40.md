---
type: is
id: is-01m0ddfjqnxkmpcqn4defgqe40
title: Cover worktree credential resolution with tests and update setup guidance
kind: task
status: open
priority: 0
version: 1
assignee: josh
labels: []
dependencies: []
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:44.948Z
updated_at: 2026-08-19T16:25:44.948Z
---
Tests, over a real linked worktree created outside the main checkout:

- key only in the main checkout `.env` resolves, and status names that path
- worktree-local `.env` overrides the main one
- exported environment variable overrides both
- outside a git repository, behavior is unchanged and no new error appears

Then update the `setup-linear` shortcut. Its join-an-already-configured-repo guidance should say that a worktree needs no per-worktree key, and drop any symlink workaround it currently suggests.
