---
type: is
id: is-01m0ddfjqnxkmpcqn4defgqe40
title: Cover worktree credential resolution with tests and update setup guidance
kind: task
status: open
priority: 0
version: 5
spec_path: null
assignee: josh
labels: []
dependencies: []
parent_id: is-01m0ddenmjsxeqm98ytfpcfc11
created_at: 2026-08-19T16:25:44.948Z
updated_at: 2026-08-19T18:08:16.488Z
---
Tests, over a real linked worktree created outside the main checkout. A temp-directory stand-in cannot exercise the resolution this feature exists for. `tests/integrations-status.test.ts` already builds a temp repo with `git init` per case, so `git worktree add` extends the existing harness rather than needing a new one.

- Key only in the main checkout `.env` resolves, and status names that path.
- Worktree-local `.env` overrides the main one.
- Exported environment variable overrides both.
- Outside a git repository, behavior is unchanged and no new error appears.
- Under `git init --separate-git-dir`, the candidate is rejected and no `.env` outside the repository is read. This is the case that distinguishes the validated resolver from a bare dirname, so it belongs in the suite rather than in review notes.

Then update the `setup-linear` shortcut. Its join-an-already-configured-repo guidance (Case B) should say that a worktree needs no per-worktree key.

Note: the shortcut currently suggests no symlink workaround, so there is nothing to remove. Verified against `docs/shortcuts/standard/setup-linear.md` at the time of writing; check again before editing in case one was added.
