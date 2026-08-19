---
type: is
id: is-01m0ddfhq83a946a4etdh5b6z0
title: Resolve the main worktree via git --git-common-dir
kind: task
status: open
priority: 0
version: 1
assignee: josh
labels: []
dependencies: []
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:43.911Z
updated_at: 2026-08-19T16:25:43.911Z
---
Add a helper that returns the main worktree path for the current directory using `git rev-parse --path-format=absolute --git-common-dir`, taking its dirname.

In the main checkout it returns that checkout, so callers need no worktree special case. Outside a git repository, or when `git` is not on PATH, it returns nothing rather than raising: layer 3 of the resolution order is skipped and behavior is unchanged.

Do not implement this by walking up the directory tree. That only works for worktrees nested inside the checkout, and past the repository root it can load an unrelated project's secrets. The parent epic records the measurement: five of six real worktrees for one repository lived outside it.
