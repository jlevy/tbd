---
type: is
id: is-01ksngytzasy3g58vne5p5athg
title: "H7: tbd-sync internal commits must be signing-agnostic (gpgsign breaks worktree init)"
kind: bug
status: closed
priority: 0
version: 5
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies: []
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T20:10:33.322Z
updated_at: 2026-05-28T03:42:11.459Z
closed_at: 2026-05-28T03:42:11.459Z
close_reason: null
---
BLOCKING for f04 (release-blocking in signed-by-default git environments). Found during review by running the merged suite; in neither GitHub review.

DEBUGGED ROOT CAUSE: tbd's machine-generated commits to the tbd-sync DATA branch never disable gpg signing. With global commit.gpgsign=true and no usable key, the initWorktree initial commit ('git commit --no-verify -m "Initialize tbd-sync branch"', packages/tbd/src/file/git.ts:1194) FAILS, leaving refs/heads/tbd-sync UNBORN.

LONG-STANDING BUT NEWLY EXPOSED (this is the key point):
- The signing gap is PRE-EXISTING in released f03 (origin/main git.ts:977 has the identical 'commit --no-verify' with no gpgsign disable; zero gpgsign handling anywhere in main's src). Verified empirically: on f03 the tbd-sync branch is ALSO left unborn under gpgsign=true ('your current branch tbd-sync does not have any commits yet').
- HOWEVER f03 TOLERATES the unborn branch: tbd create still writes .tbd/data-sync-worktree/.tbd/data-sync/issues/*.md and exits 0, so the bug was latent/invisible (f03 test suite passes under gpgsign=true).
- f04 adds a STRICTER health check ('git -C <wt> rev-parse HEAD' in checkWorktreeHealth) that classifies the unborn branch as 'corrupted' and FAILS CLOSED (by design: f04 must not fall back to direct .tbd/data-sync/). This converts the latent signing gap into a HARD failure on the FIRST command: git init (no remote) + tbd init + tbd create -> exit 1 'Shared data-sync worktree is corrupted: ... rev-parse HEAD ... fatal: ambiguous argument HEAD'.

CONCLUSION / DECISION: Fix as part of THIS f04 work, do NOT defer. f04 is what makes it break, so shipping f04 without this fix regresses every signed-by-default-git user from 'works' to 'every command errors'. It is also what fails the merged pre-push/CI suite in this environment (28 tests across child-order-e2e, spec-inherit, specs-flag, setup-flows). The merge commit '5886571 test(corrupted-data): disable commit signing in test init helper' fixed only the TEST helper, masking the production gap.

FIX (preferred, root cause): make all internal tbd-sync commits signing-agnostic by adding '-c', 'commit.gpgsign=false' to the git() invocation (prefer one shared commit helper). Call sites: packages/tbd/src/file/git.ts:1194 (the init commit that breaks fresh/no-remote repos), git.ts:1012, git.ts:1704; packages/tbd/src/cli/commands/sync.ts:446, :658, :735, :861. These are automated data commits, not user commits, so signing is inappropriate.
SECONDARY (defense in depth): have f04 init detect a failed initial commit / unborn tbd-sync and surface a clear actionable error instead of opaque 'corrupted'.

ACCEPTANCE: with global commit.gpgsign=true and no key, tbd init + create + sync all succeed and tbd-sync has a real commit; full unit + golden suite green WITHOUT any env override; no production tbd-sync commit relies on ambient signing config.
