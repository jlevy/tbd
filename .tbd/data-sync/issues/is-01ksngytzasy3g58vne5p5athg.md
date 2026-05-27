---
type: is
id: is-01ksngytzasy3g58vne5p5athg
title: "H7: tbd-sync internal commits must be signing-agnostic (gpgsign breaks worktree init)"
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies: []
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T20:10:33.322Z
updated_at: 2026-05-27T20:10:33.322Z
---
FOUND DURING REVIEW (not in either GitHub review; surfaced by running the merged suite). In any environment with global 'commit.gpgsign=true' and no usable signing key, tbd's machine-generated commits to the tbd-sync DATA branch fail, leaving tbd-sync unborn. Every subsequent command then fails health-check with 'Shared data-sync worktree is corrupted: git -C <wt> rev-parse HEAD ... fatal: ambiguous argument HEAD'. Repro: git init (no remote) + tbd init + tbd create -> exit 1.

Root cause: none of tbd's internal commits disable signing. Call sites that need -c commit.gpgsign=false (or --no-gpg-sign):
- packages/tbd/src/file/git.ts:1194 (initWorktree orphan-branch 'Initialize tbd-sync branch' — the one that breaks fresh/no-remote repos)
- packages/tbd/src/file/git.ts:1012 and :1704
- packages/tbd/src/cli/commands/sync.ts:446, :658, :735, :861
These are automated data commits on tbd-sync, not user commits, so signing is inappropriate and should be disabled (mirror the existing --no-verify pattern). The merge commit '5886571 test(corrupted-data): disable commit signing in test init helper' fixed only the TEST helper, masking the production gap.

Impact/severity: NOT caused by PR #121's merge (reproduces on pre-merge head 1e1ff21) but the f04 shared-worktree path turns it into a hard failure on the first command. It also blocks the pre-push test suite / CI-equivalent in signed-by-default environments. Pre-existing in f03 too, but worth fixing as part of this branch since it blocks green tests here.

Fix: add '-c', 'commit.gpgsign=false' to the git() invocation for every internal tbd-sync commit listed above (prefer a single helper that builds the commit args). 
Acceptance: tbd init + create + sync succeed with global commit.gpgsign=true and no key; full unit + golden suite green without needing an env override; no production tbd-sync commit relies on ambient signing config.
