# Feature: tbd-sync unrelated-history detection, prevention, and rescue

**Date:** 2026-05-29 (last updated 2026-05-29)

**Author:** Joshua Levy (with agent assistance)

**Status:** Draft

## Overview

Three related reports describe ways the `tbd-sync` branch can silently end up in an
unrecoverable or misleading state:

- **#139** — Two environments each initialize `tbd-sync` as an orphan, producing
  branches with **no common ancestor**. `tbd sync` push then fails forever, while
  `tbd doctor` reports the remote branch as **healthy**. There is no recovery path
  (`allow-unrelated` / unrelated-history handling appears nowhere in the codebase).
- **#137** — The race that creates the unrelated histories in the first place:
  independent `tbd setup --auto` runs in different environments both fall through to
  orphan creation because the remote branch isn’t visible yet, and nothing pushes the
  fresh orphan to close the window.
- **#135** — When the sync worktree is missing, older versions silently read an empty
  tracker and wrote new issues to the gitignored `.tbd/data-sync/` path.
  This is **already largely fixed** by the v0.2.0 shared-common-dir refactor (data
  commands resolve with `allowFallback: false` and auto-heal a missing worktree); we
  treat it here as verification + regression coverage.

This spec hardens the sync layer along three axes — **detection** (make the bad state
visible), **prevention** (shrink the race window), and **rescue** (a safe, automatic
recovery) — and locks each behavior in with tests.

## Goals

- `remoteBranchExists` distinguishes “branch absent” (clean negative) from “check
  failed” (ls-remote errored) and never falls through to orphan creation on the latter.
- Unrelated histories (no merge-base) are detected and reported by `tbd doctor` and
  surfaced by `tbd sync` with an actionable message — never reported as healthy.
- The freshly-created orphan `tbd-sync` is pushed immediately (best-effort) to make
  “first init wins” the canonical outcome.
- `tbd doctor --fix` recovers from unrelated histories **non-destructively** at the
  issue-file layer: safety backup branch → adopt remote as base → replay local-only
  issues + union-merge `ids.yml` → commit → fast-forward push.
- Regression tests confirm #135’s missing-worktree behavior (loud heal, no silent
  fallback writes).

## Non-Goals

- No change to the on-disk storage format (`f04`) or the `git-common-dir-v1` layout.
- No general-purpose three-way git history rewriting.
  Reconciliation happens at the issue-file layer (ULIDs guarantee no collisions), not
  the git-history layer.
- No interactive merge UI; rescue is automatic + non-destructive (a safety branch is
  always created so the prior local HEAD is recoverable).
- Not changing how genuine (shared-ancestor) divergence is merged — that path already
  works.

## Background

### Current control flow (verified against current source, v0.2.0)

**`initWorktree`** (`src/file/git.ts:1119`) decision tree:

1. local `tbd-sync` exists → attach worktree to it.
2. else `remoteBranchExists(remote, syncBranch)` → fetch + create tracking branch.
3. else → `git worktree add --orphan` + seed structure + commit
   `"Initialize tbd-sync branch"`. **No push.**

**`remoteBranchExists`** (`src/file/git.ts:708`):

```ts
try {
  await git(..., 'ls-remote', '--exit-code', remote, `refs/heads/${branch}`);
  return true;
} catch {
  return false; // Fault 1: ANY error => "no remote branch" => orphan init
}
```

`ls-remote --exit-code` exits **2** when the branch is absent but the remote was
reachable, and exits with other non-zero codes (or throws) on auth/network/transient
failure. Today both collapse to `false`.

**`checkRemoteBranchHealth`** (`src/file/git.ts:1324`):

```ts
try {
  const mergeBase = await git(..., 'merge-base', syncBranch, `${remote}/${syncBranch}`);
  const localHead = await git(..., 'rev-parse', syncBranch);
  diverged = mergeBase.trim() !== localHead.trim() && mergeBase.trim() !== remoteHead;
} catch {
  diverged = false; // Fault 2: merge-base exits non-zero for UNRELATED histories => "healthy"
}
```

`git merge-base A B` exits **1** with no output when the two commits share no ancestor.
That lands in the catch and is reported as `diverged = false` — the worst case looks
healthy.

**`pushWithRetry`** (`src/file/git.ts:634`) treats `fetch first` / `rejected` /
`non-fast-forward` as retryable, fetches + runs the field-level merge callback, and
after `MAX_PUSH_RETRIES` (3) returns `"Remote has conflicting changes."` For unrelated
histories the merge callback can’t help (the git merge has no base), so it burns three
identical attempts and falls through to the outbox.

**Recovery machinery that already exists** and we build on:

- Safety-backup-branch idiom (`src/file/git.ts:1062`):
  `git branch tbd-legacy-preserve-<ts> <head>` before a destructive op.
- `repairWorktree` / corrupted-worktree backup to `sharedBackupsDir`
  (`src/file/git.ts:1513+`).
- `reconcileMappings`, `mergeIdMappings`, `resolveIdMappingConflicts`
  (`src/file/id-mapping.ts`) and the field-level `mergeIssues` (`src/file/git.ts`).
- `attic/conflicts/` routing for issue-level conflicts.

### Why a file-layer rescue is safe (storage model)

- One file per issue, globally unique ULIDs: `issues/is-<ulid>.md` — no cross-history
  collisions.
- `mappings/ids.yml` ships with `.gitattributes: ids.yml merge=union`.
- Issue-level conflicts already route to `attic/conflicts/`.

The only real blocker is git refusing to merge histories with no common ancestor, so the
merge must happen at the issue-file layer, not the git-history layer.

### #135 status (verified)

`assembleDataContext` (`src/cli/lib/data-context.ts:172`) resolves with
`allowFallback: false`, so a missing worktree throws `WorktreeMissingError` instead of
silently using the gitignored `.tbd/data-sync/`. `withDataSyncContext` auto-repairs a
`missing`/`prunable` worktree via `ensureSharedDataSyncLayout` → `repairWorktree`. So
`create`/`list` now heal-or-throw rather than silently degrade.
Remaining work is to **prove** this with a regression test that reproduces the original
ephemeral-clone scenario and asserts no write ever lands in `.tbd/data-sync/`.

## Design

### Approach

Two phases.
Phase 1 (detection + prevention + #135 regression) is independently shippable
and stops the silent corruption and most of the race.
Phase 2 (rescue) adds the automatic recovery that turns the “unrecoverable forever”
state into a one-command fix.
Each fault is driven by a failing test first (Red → Green → Refactor), per the project
TDD guidelines.

### Components

| Area | File | Change |
| --- | --- | --- |
| Remote existence | `src/file/git.ts` `remoteBranchExists` | Return a tri-state result distinguishing absent / present / check-failed |
| Init | `src/file/git.ts` `initWorktree` | Refuse orphan creation when remote check failed; push orphan immediately (best-effort) |
| Detection | `src/file/git.ts` `checkRemoteBranchHealth` | Add `unrelated: boolean`; set it when `merge-base` finds no common ancestor (distinguish from “local branch absent”) |
| Doctor report | `src/cli/commands/doctor.ts` | Report unrelated state as a hard finding (not healthy) and route to rescue, not plain `tbd sync` |
| Sync messaging | `src/cli/commands/sync.ts` / `pushWithRetry` | Detect unrelated-history push rejection; emit dedicated message + remediation instead of 3 identical retries |
| Rescue | `src/file/git.ts` (new `rescueUnrelatedHistory`) + `doctor.ts --fix` wiring | Non-destructive issue-file-layer reconciliation |
| #135 | `tests/` | Regression test(s); small loud-failure tweak only if a gap is found |

### Detailed design

#### Fault 1 — `remoteBranchExists` fails open

Introduce a tri-state so callers can act on the distinction:

```ts
export type RemoteBranchProbe = 'present' | 'absent' | 'check-failed';

export async function probeRemoteBranch(
  remote: string, branch: string, baseDir?: string,
): Promise<RemoteBranchProbe> {
  try {
    await git(..., 'ls-remote', '--exit-code', remote, `refs/heads/${branch}`);
    return 'present';
  } catch (err) {
    // ls-remote --exit-code exits 2 when the connection succeeded but the ref
    // is absent; any other failure (auth/network/transient) is a check failure.
    return exitCodeOf(err) === 2 ? 'absent' : 'check-failed';
  }
}
```

Keep `remoteBranchExists` as a thin `=== 'present'` wrapper for existing callers
(`uninstall`, `init`) to avoid churn.
In `initWorktree`, branch on the tri-state:

- `present` → fetch + create tracking branch (as today).
- `absent` → orphan creation is safe.
- `check-failed` → **do not** create an orphan; return a clear error (`"Could not verify
  whether origin/tbd-sync exists (remote check failed); refusing to create a divergent
  local branch. Check connectivity/auth and retry."`).

Need a reliable way to read git’s exit code: the `git()` wrapper currently throws an
`Error` with a message.
Extend the wrapper (or the thrown error) to carry `exitCode` so `probeRemoteBranch` can
inspect it without string-matching.
(Structural change, commit separately.)

#### Fault 1b (#137) — push the fresh orphan immediately

After the orphan is created and the initial commit is made, attempt
`git push origin tbd-sync` best-effort with transient-retry, ignoring failure
(restricted egress / no auth must not break setup).
This makes “first init wins” the canonical outcome and shrinks the race window from
“until first sync” to “until setup completes”.

#### Fault 2 — detect unrelated histories

Extend `RemoteBranchHealth` with `unrelated: boolean`. In `checkRemoteBranchHealth`,
determine whether a local branch exists first (so “no local branch” stays
`diverged=false, unrelated=false`), then run `merge-base`:

- `merge-base` succeeds → compute `diverged` as today, `unrelated=false`.
- local branch exists **and** `merge-base` exits non-zero (no common ancestor) →
  `unrelated=true` (and `diverged=true` for callers that only check divergence).
- local branch absent → both false.

Use `git merge-base --is-ancestor` / explicit exit-code handling rather than a bare
try/catch so transient errors don’t masquerade as “unrelated”.

`tbd doctor` (`doctor.ts:~1246/1302`): when `unrelated`, emit a hard ✗ finding
(`"Sync histories are unrelated (no common ancestor) — push cannot succeed"`) whose
remediation is `tbd doctor --fix` (the rescue), **not** `tbd sync`.

`tbd sync` (`sync.ts` push-failure block, ~line 919): when the push fails and
`checkRemoteBranchHealth` reports `unrelated`, replace the generic “Remote has
conflicting changes” with the dedicated message and point at `tbd doctor --fix`.
Optionally short-circuit `pushWithRetry` so it doesn’t burn 3 identical attempts on an
unrelated-history rejection.

#### Rescue mode — `rescueUnrelatedHistory` (non-destructive)

New function invoked by `tbd doctor --fix` when `unrelated` is detected:

1. `git fetch origin tbd-sync`.
2. Safety net: `git branch tbd-backup-<nowFilenameTimestamp()> <local tbd-sync HEAD>`
   (reuse the existing preserve-branch idiom).
   Prior local state is always recoverable.
3. Compute the content delta keyed by ULID: issue files (and any mapping rows) present
   on local `tbd-sync` but absent on `origin/tbd-sync`. Robust to the missing merge base
   because it’s a file-set diff, not a git merge.
4. Adopt remote as canonical base: reset the worktree’s `tbd-sync` to `origin/tbd-sync`
   (preserved by step 2).
5. Re-apply the local-only issue files; union-merge `ids.yml` via existing
   `mergeIdMappings`; run `reconcileMappings` so every issue has a backing mapping and
   vice-versa (closes the “62 map entries vs 57 files” inconsistency noted in #139);
   commit `"tbd rescue: adopt remote base + reapply N local-only issue(s)"`.
6. Return control; the normal push is now a clean fast-forward.

Post-conditions asserted by tests:
`git merge-base --is-ancestor origin/tbd-sync tbd-sync` is true (push fast-forwards);
issue-file count equals id-map entry count; no duplicate public IDs; the backup branch
exists and contains the pre-rescue HEAD.

#### #135 — verify + regression

Add a golden/e2e (tryscript) scenario reproducing: repo with issues on `tbd-sync`, fresh
clone with the worktree absent, then `tbd list` / `tbd create` / `tbd sync`. Assert: the
worktree is auto-materialized (or the command fails loudly), `tbd list` reflects the
real issues, and **no file is ever written under `.tbd/data-sync/`** (the gitignored
wrong location).
Only add code (e.g. distinguishing “no issues” from “store unavailable”)
if the test exposes a residual gap.

### API Changes

- New exported `probeRemoteBranch` + `RemoteBranchProbe` type in `src/file/git.ts`;
  `remoteBranchExists` retained as a wrapper.
- `RemoteBranchHealth` gains `unrelated: boolean`.
- New exported `rescueUnrelatedHistory` (or equivalent) in `src/file/git.ts`.
- `git()` wrapper / thrown error carries `exitCode` (internal).

## Implementation Plan

### Phase 1: Detection, prevention, and #135 regression

- [ ] Make the `git()` error carry `exitCode` (structural; commit separately).
- [ ] `probeRemoteBranch` tri-state + `remoteBranchExists` wrapper; unit tests for
  absent vs check-failed (mock/stub git exit codes).
- [ ] `initWorktree`: refuse orphan on `check-failed`; best-effort immediate push of the
  fresh orphan. Tests cover both.
- [ ] `checkRemoteBranchHealth`: add `unrelated`; tests for unrelated, genuinely
  diverged, in-sync, and no-local-branch cases.
- [ ] `tbd doctor`: report `unrelated` as a hard finding routing to `--fix`; update
  `doctor-sync` tests / golden output.
- [ ] `tbd sync`: dedicated unrelated-history message + remediation; avoid 3 wasted
  retries.
- [ ] #135 regression scenario (tryscript) — missing worktree heals/fails loudly, never
  writes to `.tbd/data-sync/`.

### Phase 2: Non-destructive rescue

- [ ] `rescueUnrelatedHistory`: fetch → backup branch → file-set delta → adopt remote →
  replay local-only issues + union ids.yml + `reconcileMappings` → commit.
- [ ] Wire into `tbd doctor --fix`; after rescue, normal sync fast-forwards.
- [ ] Tests: construct two unrelated `tbd-sync` roots in a temp repo, run rescue, assert
  fast-forward-ability, file/map consistency, no duplicate IDs, backup branch present,
  and that local-only beads survive.
- [ ] End-to-end tryscript: race → detect → `tbd doctor --fix` → `tbd sync` → in sync.

## Testing Strategy

- **Unit** — `probeRemoteBranch` exit-code mapping; `checkRemoteBranchHealth` flag
  matrix; rescue delta computation (pure where possible).
- **Integration** — temp-repo helpers that build two unrelated orphan roots and a
  reachable “remote”; assert detection + rescue outcomes against real `git`.
- **Golden/tryscript** — extend the existing `tests/cli-sync-*.tryscript.md` family (and
  worktree-scenarios) with the race, unrelated-history doctor output, the rescue flow,
  and the #135 missing-worktree reproduction.
  Filter unstable fields (timestamps, ULIDs/backup-branch names) per the golden-testing
  guideline.
- TDD: one failing test per fault before the fix; run the full (non-long) suite each
  step; keep structural and behavioral commits separate.

## Rollout Plan

Lands on `claude/eager-brown-tBntt` → draft PR. Phase 1 is shippable on its own (stops
silent corruption + the race).
Ships in the next `get-tbd` release; existing repos already stuck in the unrelated state
are recovered by upgrading and running `tbd doctor --fix`.

## Open Questions

- Should `tbd sync` short-circuit `pushWithRetry` entirely on a detected unrelated
  rejection, or keep one attempt for the (rare) benign-race case before reporting?
  (Lean: detect up front, skip the wasted retries.)
- Backup-branch retention: leave `tbd-backup-<ts>` branches indefinitely, or have a
  later `tbd doctor` offer to prune old ones?
  (Lean: leave them; cheap and safe.)

## References

- Issues: #139 (detection/rescue), #137 (race/prevention), #135 (silent fallback).
- `src/file/git.ts` — `remoteBranchExists` (708), `initWorktree` (1119),
  `checkRemoteBranchHealth` (1324), `pushWithRetry` (634), preserve-branch idiom (1062),
  `repairWorktree` (1513+).
- `src/cli/commands/sync.ts`, `src/cli/commands/doctor.ts`,
  `src/cli/lib/data-context.ts`, `src/lib/paths.ts` (`resolveDataSyncDir`).
- Prior art: `plan-2026-01-28-sync-worktree-recovery-and-hardening.md`,
  `plan-2026-05-17-shared-common-dir-sync-worktree.md`.
- Guideline: `tbd-sync-troubleshooting`.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
