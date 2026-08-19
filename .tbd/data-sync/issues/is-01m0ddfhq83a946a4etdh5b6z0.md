---
type: is
id: is-01m0ddfhq83a946a4etdh5b6z0
title: Resolve the main worktree via git --git-common-dir
kind: task
status: closed
priority: 0
version: 8
spec_path: null
assignee: josh
labels: []
dependencies:
  - type: blocks
    target: is-01m0ddfj2qkwxhej9p8q30qs9y
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:43.911Z
updated_at: 2026-08-19T19:51:05.437Z
closed_at: 2026-08-19T19:51:05.435Z
close_reason: null
---
Add a helper that returns the main worktree path for the current directory, built on `resolveGitCommonDir` in `lib/paths.ts`. That function already asks git for the common directory, with the `--path-format=absolute` fallback and realpath normalization handled, so this is a wrapper rather than a second `rev-parse`.

Taking the common dir's dirname produces a *candidate*, not an answer. Accept it only when git, asked from inside the candidate, agrees on both facts:

- `rev-parse --path-format=absolute --show-toplevel` equals the candidate, so it is a worktree root rather than an arbitrary directory.
- `rev-parse --path-format=absolute --git-common-dir` equals the common dir we started from, so it belongs to this repository.

Anything else returns nothing and layer 3 is skipped. Outside a git repository, or when `git` is not on PATH, it returns nothing rather than raising.

The validation is not defensive padding. Under `git init --separate-git-dir` the common dir lives outside the checkout, so the bare dirname lands on an unrelated sibling directory, which is exactly the cross-project `.env` read this approach is supposed to rule out. `git worktree list --porcelain` has the same flaw under that shape: its first entry reports the git dir rather than a checkout. Measured across four repository shapes, the bare dirname is correct for two and wrong for two; with both checks it is correct for two and returns nothing for two.

In the main checkout the helper returns that checkout, so callers need no worktree special case.

Do not implement this by walking up the directory tree. That only works for worktrees nested inside the checkout, and past the repository root it can load an unrelated project's secrets. The parent epic records the measurement: five of six real worktrees for one repository lived outside it.
