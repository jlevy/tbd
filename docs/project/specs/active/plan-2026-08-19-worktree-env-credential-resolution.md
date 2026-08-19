---
title: "Worktree .env Credential Resolution"
description: Resolve integration credentials from the main worktree's .env so a configured repository stays configured when viewed from any linked worktree
author: Joshua Levy (github.com/jlevy) with Claude assistance
---
# Feature: Worktree .env Credential Resolution

**Date:** 2026-08-19

**Author:** Joshua Levy (github.com/jlevy) with Claude assistance

**Status:** Draft

## Overview

In a linked git worktree, tbd reports `LINEAR_API_KEY not found` even when the key sits
in the repository’s `.env`. `.env` is gitignored, and gitignored files do not propagate
to worktrees, so a fully configured repository looks unconfigured from any worktree of
it.

Add the main worktree’s `.env` as a final fallback in credential resolution, resolved
through git rather than through the filesystem.

## Goals

- A worktree created anywhere on disk resolves the credential its repository already
  holds.
- The reported credential source names the file it came from, so a per-worktree override
  is discoverable and a cross-directory read is never silent.
- Resolution cannot reach outside the repository, under every repository shape.
- Outside a git repository, behavior is unchanged and no new error appears.

## Non-Goals

- Writing to the main worktree’s `.env`. The fallback is read-only.
- Sharing any other gitignored file across worktrees.
  This covers integration secrets only.
- Changing CI behavior.
  GitHub Actions injects secrets as environment variables and does not use worktrees.

## Background

The failure mode is worse than a missing feature, because the diagnosis is misleading.
`tbd integration status` prints what reads as “Linear is not set up here”, when the
truth is “the key exists, in the main checkout, and this process did not look there”.
That sent an operator into the guided first-time-setup path for a repository whose
Linear integration was already configured and working.

This is now common rather than exotic.
Agent tooling creates worktrees automatically, and a single machine can carry many per
repository, created by different tools in different locations.

### Why Directory Walking Does Not Work

Walking up the directory tree looking for `.env`, which is what `python-dotenv`’s
`find_dotenv()` and `direnv` do, only works when the worktree happens to be nested
inside the main checkout.
Measured against one real machine’s worktrees for a single repository, five of six lived
outside it:

| Worktree location | Walk-up reaches the repo? |
| --- | --- |
| `~/wrk/{org}/{repo}/.claude/worktrees/{id}` | yes, nested |
| `~/.cache/{tool}/{id}` | no |
| `~/.codex/worktrees/{id}/{repo}` | no, three of these |
| `~/.codex/worktrees/{id}/{other-repo}` | no |

Directory walking also has a security footgun: past the repository root it can pick up
an unrelated project’s secrets, and the deeper the walk the likelier that is.

### Why Git’s Answer Needs Validation

Asking git which repository this is beats inferring it from the filesystem:

```bash
dirname "$(git rev-parse --path-format=absolute --git-common-dir)"
```

The precedent is git’s own design.
Config, hooks, and refs live in the common dir because they are repository-scoped rather
than branch-scoped.
A gitignored `.env` holding machine-local credentials is exactly that
class of state: it does not vary by branch, so sharing it across worktrees is correct
rather than merely convenient.

That expression is right for the ordinary repository shape and wrong for one real
variant. Under `git init --separate-git-dir`, the common dir is not inside the checkout,
so its dirname lands on an unrelated sibling directory:

| Repository shape | `dirname(--git-common-dir)` | Correct? |
| --- | --- | --- |
| Normal repo, main checkout | the checkout | yes |
| Normal repo, linked worktree outside it | the main checkout | yes |
| `--separate-git-dir`, main checkout | the git dir’s parent | no |
| `--separate-git-dir`, linked worktree | the git dir’s parent | no |

`git worktree list --porcelain` is no better: under the same shape its first entry
reports the git dir rather than a checkout.

So the candidate must be verified rather than trusted.
A candidate is the main worktree only when git, asked from inside that candidate, agrees
on both facts: the candidate is a worktree root, and it belongs to this same repository.
Both checks together are what make the “cannot leave the repository” property true
rather than assumed.

## Design

### Resolution Order

Resolution order for `LINEAR_API_KEY` and any other integration secret:

1. The process environment.
   Always wins. Unchanged.
2. `./.env` in the current working tree.
   Present-but-different is a deliberate override, so a worktree can point at different
   credentials.
3. `<main-worktree>/.env`, resolved and validated through git.
   This is the new fallback.
4. Not found.

Layers 1 and 2 keep their current precedence and behavior.

### Resolving the Main Worktree

`resolveGitCommonDir` in `lib/paths.ts` already asks git for the common directory, with
the `--path-format=absolute` fallback and realpath normalization handled.
The new helper builds on it rather than issuing its own `rev-parse`.

Taking the dirname produces a candidate.
Accept it only when both hold:

- `git -C <candidate> rev-parse --path-format=absolute --show-toplevel` equals the
  candidate, so the candidate is a worktree root rather than an arbitrary directory.
- `git -C <candidate> rev-parse --path-format=absolute --git-common-dir` equals the
  common dir we started from, so it belongs to this repository.

Anything else returns nothing, and layer 3 is skipped.
Outside a git repository, or when `git` is not on PATH, the helper returns nothing
rather than raising.

Under `--separate-git-dir` this costs a linked worktree its fallback, which is the right
trade: the alternative is reading a neighboring project’s `.env`. The main checkout of
such a repository is unaffected, since layer 2 already covers it.

### Reporting the Source

`CredentialSource` currently distinguishes `env`, `dotenv`, and `gh-cli`, and status
renders `dotenv` as the bare string `.env`. Once resolution can reach outside the
current directory that is ambiguous, so `ResolvedCredential` carries the absolute path
it was read from and status prints it.
Masking is unchanged: never print the key itself.

The `.env` safety finding follows the same file.
`envFileFinding` reports whether a `.env` exists and whether git ignores it, and today
it asks only about the current working tree.
When the credential came from the main worktree, that is the file whose ignore status
matters, and reporting on a different file than the one in use is how a committed key
stays invisible.

### Components

| File | Change |
| --- | --- |
| `lib/paths.ts` | Add the validated main-worktree helper beside `resolveGitCommonDir` |
| `integrations/core/credentials.ts` | Add layer 3; carry the resolved path on `ResolvedCredential` |
| `integrations/core/status.ts` | Name the source path; point the safety finding at the file actually read |
| `docs/shortcuts/standard/setup-linear.md` | Joining from a worktree needs no per-worktree key |

## Implementation Plan

One phase. The four steps are sequential because each consumes the previous one’s
surface.

- [ ] **Main-worktree helper** (`tbd-mcw6`). The validated resolver, built on
  `resolveGitCommonDir`, returning nothing rather than raising.
- [ ] **Credential fallback** (`tbd-fzm7`). Layer 3 wired into `resolveCredential`, with
  the read path carried on the result.
- [ ] **Source reporting** (`tbd-lxjr`). Status names the file, and the `.env` safety
  finding follows it.
- [ ] **Tests and setup guidance** (`tbd-0tc3`).

## Testing Strategy

Over a real linked worktree created outside the main checkout, since a temp-directory
stand-in cannot exercise the resolution this feature exists for:

- Key only in the main checkout’s `.env` resolves, and status names that path.
- A worktree-local `.env` overrides the main one.
- An exported environment variable overrides both.
- Outside a git repository, behavior is unchanged and no new error appears.
- Under `--separate-git-dir`, the candidate is rejected and no `.env` outside the
  repository is read. This is the case that distinguishes the validated resolver from the
  bare dirname, so it belongs in the suite rather than in review notes.

`tests/integrations-status.test.ts` already builds a temp repo with `git init` per case,
so `git worktree add` extends the existing harness rather than needing a new one.

## Rollout

No format change, no config change, no migration.
The behavior is additive: a repository that resolves its credential today resolves the
same one afterward, from the same layer.

Until this lands, exporting the key from a shell profile or a secret-manager wrapper
satisfies layer 1 and works in every worktree.

## Open Questions

- A worktree on a branch whose `.gitignore` does not cover `.env` will report a
  different safety verdict than the main checkout does for the same file.
  Reporting on the file actually read is the intended behavior, and whether it deserves
  distinct wording is worth deciding when the finding is written.

## References

- [Beads: `tbd-30t7`](https://linear.app/finterm-ai/issue/OS-350) and its four children
- `git rev-parse --git-common-dir`,
  [git-rev-parse documentation](https://git-scm.com/docs/git-rev-parse)
- `plan-2026-08-10-external-tracker-integrations.md`, which introduced `.env` credential
  loading

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
