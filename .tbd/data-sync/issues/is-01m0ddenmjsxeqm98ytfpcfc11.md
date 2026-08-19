---
type: is
id: is-01m0ddenmjsxeqm98ytfpcfc11
title: Resolve .env from the main worktree so credentials work in linked worktrees
kind: epic
status: open
priority: 0
version: 11
spec_path: docs/project/specs/active/plan-2026-08-19-worktree-env-credential-resolution.md
assignee: josh
labels: []
dependencies: []
child_order_hints:
  - is-01m0ddfhq83a946a4etdh5b6z0
  - is-01m0ddfj2qkwxhej9p8q30qs9y
  - is-01m0ddfjd4q6zawvdwh008w9h2
  - is-01m0ddfjqnxkmpcqn4defgqe40
created_at: 2026-08-19T16:25:15.153Z
updated_at: 2026-08-19T18:00:01.877Z
extensions:
  linear:
    id: d1a8282c-7a55-4ec3-ad74-5d329037c4b1
    linked_at: 2026-08-19T16:27:29.457Z
---
## The Problem

In a linked git worktree, tbd reports `LINEAR_API_KEY not found` even when the key is
present in the repository's `.env`. `.env` is gitignored, and gitignored files do not
propagate to worktrees, so a fully configured repository looks unconfigured from any
worktree of it.

The failure mode is worse than a missing feature, because the diagnosis is misleading.
`tbd integration status` prints what reads as "Linear is not set up here", when the truth
is "the key exists, in the main checkout, and this process did not look there". That sent
an operator into the guided first-time-setup path for a repository whose Linear
integration was already configured and working.

This is now common rather than exotic. Agent tooling creates worktrees automatically, and
a single machine can carry many per repository, created by different tools in different
locations.

## Why the Obvious Fix Does Not Work

Walking up the directory tree looking for `.env`, which is what `python-dotenv`'s
`find_dotenv()` and `direnv` do, only works when the worktree happens to be nested inside
the main checkout. Measured against one real machine's worktrees for a single repository,
five of six lived outside it:

| Worktree location | Walk-up reaches the repo? |
| -- | -- |
| `~/wrk/{org}/{repo}/.claude/worktrees/{id}` | yes, nested |
| `~/.cache/{tool}/{id}` | no |
| `~/.codex/worktrees/{id}/{repo}` | no, three of these |
| `~/.codex/worktrees/{id}/{other-repo}` | no |

Directory-walking also has a security footgun: past the repository root it can pick up an
unrelated project's secrets, and the deeper the walk the likelier that is.

## The Mechanism

Ask git which repository this is, rather than inferring it from the filesystem:

```bash
dirname "$(git rev-parse --path-format=absolute --git-common-dir)"
```

For the ordinary repository shape this resolves to the main checkout exactly, wherever
that worktree lives, and in the main checkout it resolves to that checkout, so one code
path covers both cases.

It produces a candidate rather than an answer. Under `git init --separate-git-dir` the
common dir sits outside the checkout, so the dirname lands on an unrelated sibling
directory. The candidate is therefore verified before use: asked from inside it, git must
agree both that it is a worktree root and that its common dir is the one we started from.
Measured across four repository shapes, the bare dirname is correct for two and wrong for
two; with the checks it is correct for two and returns nothing for two.

The precedent is git's own design. Config, hooks, and refs live in the common dir because
they are repository-scoped rather than branch-scoped. A gitignored `.env` holding
machine-local credentials is exactly that class of state: it does not vary by branch, so
sharing it across worktrees is correct rather than merely convenient.

## Specified Behavior

Resolution order for `LINEAR_API_KEY` and any other integration secret:

1. The process environment. Always wins. Unchanged.
2. `./.env` in the current working tree. Present-but-different is a deliberate override,
   so a worktree can point at different credentials.
3. `<main-worktree>/.env`, resolved via `--git-common-dir`. This is the new fallback.
4. Not found.

Requirements beyond the lookup itself:

* **Report the source.** `tbd integration status` already prints a masked credential and
  its origin, in the form `********abcd from .env`. It must name which `.env`, so loading
  from another directory is never silent and a layer-2 override is discoverable.
* **Never write to the main worktree's** `.env`**.** The fallback is read-only. Guided setup
  that writes a key writes it to the current worktree or instructs on the environment.
* **Degrade quietly.** Outside a git repository, or when `git` is unavailable, skip layer
  3 rather than raising.
* **Do not cross repository boundaries.** This is the property that makes the approach
  safe where directory-walking is not, and it comes from validating the candidate, not
  from `--git-common-dir` alone.

## Acceptance

* From a worktree created outside the main checkout, with the key present only in the main
  checkout's `.env`, `tbd integration status` reports reachable and names the source path.
* A worktree-local `.env` still overrides the main one.
* An exported environment variable still overrides both.
* Outside a git repository, behavior is unchanged and no new error appears.
* The `setup-linear` shortcut's guidance for joining an already-configured repo is
  updated: joining from a worktree needs no per-worktree key.

## Scope Notes

CI is unaffected. GitHub Actions injects secrets as environment variables, satisfying
layer 1, and does not use worktrees.

Until this lands, exporting the key from a shell profile or a secret-manager wrapper
satisfies layer 1 and works in every worktree. Symlinking the main checkout's `.env` into
each worktree also works, but is manual and must be repeated for every worktree any tool
creates.
