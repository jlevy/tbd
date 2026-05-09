---
title: Multi-Worktree Sync Support
description: Allow tbd to operate in multiple checkouts of the same repo by switching the hidden sync worktree to a detached-HEAD model
---
# Feature: Multi-Worktree Sync Support

**Date:** 2026-05-08

**Author:** Joshua Levy with Claude

**Status:** Draft

## Overview

`tbd init`, `tbd sync`, and `tbd doctor --fix` all break when more than one
working tree of the same repository tries to use tbd at the same time (for
example: a primary checkout at `~/wrk/aisw/trading` and a Codex agent
checkout at `~/.codex/worktrees/d21f/trading`). The second checkout fails
with:

```
fatal: 'tbd-sync' is already used by worktree at
'.../trading/.tbd/data-sync-worktree'
```

Both checkouts share one `.git` common dir, so git enforces its
"one branch, one worktree" rule on the `tbd-sync` ref. The current design
attaches the hidden worktree directly to `tbd-sync` (commit advances the
branch ref as a side effect), which makes that ref claim exclusive and
prevents any second checkout from creating its own worktree.

This spec changes the hidden worktree to a **detached-HEAD checkout** that
points at the current `tbd-sync` commit, and advances the branch ref
explicitly with a compare-and-swap `git update-ref`. Detached worktrees do
not claim the branch, so any number of sibling checkouts can each have
their own hidden worktree without conflict.

## Goals

- **G1:** A user with N working trees of the same repo can run `tbd setup`,
  `tbd create`, and `tbd sync` from any of them without `git worktree add`
  failing.
- **G2:** Concurrent commits from sibling worktrees cannot silently lose
  data — the branch advance is a compare-and-swap, with a documented merge
  loop on conflict.
- **G3:** Existing repos with the current attached worktree are migrated
  automatically by `tbd doctor --fix` (and lazily by `tbd sync`) to the
  detached model, with no user-visible step.
- **G4:** Pull semantics, conflict-resolution semantics, and remote push
  semantics are unchanged from the user's perspective.

## Non-Goals

- Coordinating concurrent `tbd sync` runs across worktrees with locks. The
  CAS retry gives correctness; if both worktrees commit truly
  simultaneously, the second one merges the first's commit and tries
  again. We do not introduce a process-level lock.
- Sharing a single physical worktree directory across checkouts (option 2
  in the prior research). This is architecturally cleaner but requires
  resolving paths through `git rev-parse --git-common-dir`, which has
  larger blast radius. Documented as future work.
- Multi-process `tbd` invocations *inside the same checkout* — the existing
  single-checkout assumptions still hold there.
- Backwards compatibility with tbd <= v0.1.26 running concurrently with the
  new code in different checkouts of the same repo. Users must upgrade all
  checkouts; mixed-version multi-checkout is best-effort.

## Background

### Current architecture

`packages/tbd/src/file/git.ts:903-985` (`initWorktree`) creates the hidden
worktree like this:

```ts
// local branch exists:
await git('-C', baseDir, 'worktree', 'add', worktreePath, syncBranch);
// remote branch exists:
await git('-C', baseDir, 'worktree', 'add', '-b', syncBranch,
          worktreePath, `${remote}/${syncBranch}`);
// neither exists:
await git('-C', baseDir, 'worktree', 'add', '--orphan', '-b',
          syncBranch, worktreePath);
```

A comment at line 926-927 explicitly documents the rationale:

> Note: Don't use --detach here - we want commits to update tbd-sync branch.

`pushChanges()` and `commitWorktreeChanges()` in `sync.ts` then commit
*inside the worktree* with `git -C <worktree> commit`. Because the
worktree's HEAD is `refs/heads/tbd-sync`, that commit advances the branch
ref as a side effect. `commitToSyncBranch()` and `pullChanges()` already
demonstrate the alternative pattern — they use `withIsolatedIndex()`
plus `git update-ref refs/heads/tbd-sync <sha>` to advance the ref
without checking the branch out (`sync.ts:471-479`).

### Why this fails for sibling worktrees

`git worktree add` refuses to create a second worktree on a branch that
is already attached to another worktree:

```
fatal: 'tbd-sync' is already used by worktree at '...'
```

This is a hard rule per ref. There is no `--force` that bypasses it
*safely* — see "Research" below. `tbd doctor --fix` cannot fix this on
the secondary checkout because the conflict is not a corrupted state; the
primary's attached worktree is doing exactly what it was designed to do.

### Existing partial precedents in the codebase

- `sync.ts:472-479` uses `withIsolatedIndex` + `git update-ref` for pull,
  which is the pattern this spec generalizes to push.
- `commitToSyncBranch()` in `git.ts:223` uses `read-tree`/`write-tree`/
  `commit-tree` directly — never enters a worktree. This is a worktree-
  free write path that already exists but is currently unused for the
  hot push path.
- `ensureWorktreeAttached()` (`git.ts:1360`) was added specifically to
  *re-attach* worktrees from old tbd versions that used `--detach`. We
  invert this: detached is now the desired state, and old attached
  worktrees are repaired *to* detached.

### Prior design context

The current attached design was a deliberate choice during the
sync-worktree-recovery work. See:

- `docs/project/specs/done/plan-2026-01-28-sync-worktree-recovery-and-hardening.md`
  — covers four failure modes (missing, prunable, corrupted, fresh clone)
  but does not consider sibling worktrees.
- `docs/project/retrospectives/retro-2026-01-16-worktree-architecture-not-implemented.md`
  — original v1 design used `--detach`; the current code drops it for
  simplicity.
- `packages/tbd/docs/tbd-design.md` §2.3 — describes the worktree as
  attached; does not mention multi-checkout.

This spec consciously revisits Decision 7 (§7.1 in tbd-design.md) for
the multi-checkout case.

## Research: exact git semantics

The following observations were verified locally against `git 2.43.0` in
a sandbox repo (`/tmp/wt-research`). Each is a reproducible observation,
not a guess.

### R1. The "one branch, one worktree" rule is enforced per ref

```
$ git worktree add .tbd/data-sync-worktree tbd-sync
fatal: 'tbd-sync' is already used by worktree at
       '<other-checkout>/.tbd/data-sync-worktree'
```

The lock is on `refs/heads/tbd-sync`, not on the directory. Two
worktrees of the same repo are fine; two worktrees attached to the
same branch are not.

### R2. `--detach` bypasses the rule

```
$ git worktree add --detach .tbd/data-sync-worktree tbd-sync
Preparing worktree (detached HEAD <sha>)
```

This succeeds even when another worktree currently has `tbd-sync`
attached. The new worktree's HEAD is `<sha>` directly (no symbolic ref),
so it does not claim the branch. `git -C <wt> symbolic-ref HEAD` returns
`fatal: ref HEAD is not a symbolic ref`, and `git status` shows
`Not currently on any branch.`

### R3. `--force` "works" but corrupts sibling working trees

```
$ git worktree add --force .tbd/data-sync-worktree tbd-sync
Preparing worktree (checking out 'tbd-sync')
HEAD is now at <sha> ...
```

After this, *both* worktrees show `branch refs/heads/tbd-sync` in
`git worktree list --porcelain`. When one of them commits, the *other*
worktree's HEAD silently advances (because both follow the branch ref)
while its working tree files do not change — `git status` then reports
phantom deletions for every file added by the sibling. **`--force` is
not a viable fix** for tbd's case; it causes data-loss-shaped bugs
that are exactly what plan-2026-01-28 was meant to prevent.

### R4. `git update-ref` is a compare-and-swap

```
$ git update-ref refs/heads/tbd-sync <new-sha> <expected-old-sha>
```

If `<expected-old-sha>` does not match the current ref value, the
update fails atomically with:

```
fatal: update_ref failed for ref 'refs/heads/tbd-sync':
       cannot lock ref 'refs/heads/tbd-sync': is at <X> but expected <Y>
```

This is the primitive we need to replace "commit inside an attached
worktree advances the branch" with "commit on detached HEAD, then CAS
the branch ref."

### R5. A detached worktree's `git commit` advances HEAD only

```
$ git -C <detached-wt> commit -m "..."   # advances HEAD
$ git -C <detached-wt> rev-parse HEAD    # new sha
$ git -C <other-wt>   rev-parse tbd-sync # unchanged
```

The branch ref is *not* touched. Multiple detached worktrees can each
have a different HEAD with no interference. The branch ref is advanced
explicitly via `git update-ref` after each commit (or sequence of
commits) the worktree wants to publish.

### R6. `git -C <detached-wt> checkout --detach <branch>` re-attaches

```
$ git -C <wt> checkout --detach tbd-sync
HEAD is now at <sha> ...
```

This is how a worktree catches up to the latest branch ref *without*
claiming the branch. We use it after a sibling advances `tbd-sync` and
before the local worktree starts new work.

### R7. `git merge` works on detached HEAD

```
$ git -C <detached-wt> merge origin/tbd-sync -m "..."
```

Behavior is identical to attached HEAD — a merge commit is created and
HEAD advances. Conflict resolution paths in `sync.ts:836-940` need no
behavioral changes; they only need to advance `tbd-sync` via `update-ref`
afterward instead of relying on the attached-HEAD side effect.

### R8. `git worktree list --porcelain` lets us detect ownership

```
worktree /path/to/wt
HEAD <sha>
detached
                          ← (or)
worktree /path/to/wt
HEAD <sha>
branch refs/heads/tbd-sync
```

We can iterate this output to answer: "is `tbd-sync` currently attached
to *any* worktree, and if so, which one?" — needed for migration of
legacy attached worktrees and for diagnostics.

## Reproduction

The following script reproduces the bug and validates the fix from
clean state. It runs against `git >= 2.42` (orphan worktree support).

```bash
#!/usr/bin/env bash
# tryscript: reproduces multi-worktree tbd-sync conflict and verifies fix
set -euo pipefail

D=$(mktemp -d); cd "$D"
git init --bare -q origin.git
git -C origin.git symbolic-ref HEAD refs/heads/main
git clone -q origin.git primary
cd primary
git -c commit.gpgsign=false commit --allow-empty -q -m init
git push -q -u origin main
git worktree add -q -b feature/codex ../codex-trading

# === BUG REPRODUCTION (current behavior) ===
# Primary creates the attached tbd-sync worktree:
git worktree add -q --orphan -b tbd-sync .tbd/data-sync-worktree
( cd .tbd/data-sync-worktree
  echo schema_version: 1 > meta.yml
  git add . && git -c commit.gpgsign=false commit -q -m init-tbd-sync )

# Secondary tries the same — FAILS:
cd ../codex-trading
git worktree add .tbd/data-sync-worktree tbd-sync
# fatal: 'tbd-sync' is already used by worktree at '.../primary/.tbd/data-sync-worktree'

# === FIX VERIFICATION (proposed behavior) ===
# Primary's attached worktree is migrated to detached:
cd ../primary
git -C .tbd/data-sync-worktree checkout --detach tbd-sync

# Secondary creates its own detached worktree — SUCCEEDS:
cd ../codex-trading
git worktree add -q --detach .tbd/data-sync-worktree tbd-sync

# Both worktrees can independently commit:
( cd .tbd/data-sync-worktree
  echo a > issue1.yml
  git add . && git -c commit.gpgsign=false commit -q -m secondary )

# Advance the branch ref via CAS (would be done by tbd internally):
NEW=$(git -C .tbd/data-sync-worktree rev-parse HEAD)
OLD=$(git -C ../primary rev-parse tbd-sync)
git -C .tbd/data-sync-worktree update-ref refs/heads/tbd-sync "$NEW" "$OLD"

# Primary catches up to the new ref:
cd ../primary/.tbd/data-sync-worktree
git checkout -q --detach tbd-sync
ls   # sees secondary's issue1.yml
```

## Design

### Approach

Replace the attached-HEAD worktree with a **detached-HEAD worktree plus
explicit branch ref advancement**. Three primitives:

1. **Init/repair:** `git worktree add --detach <path> tbd-sync` (or
   `--orphan` for first-time setup, then `git checkout --detach` to
   detach immediately after the initial commit).
2. **Commit:** `git -C <wt> commit` advances HEAD only.
3. **Publish (CAS):** `git update-ref refs/heads/tbd-sync <newHead>
   <expectedOld>`. On CAS failure, fetch the new ref, merge into
   detached HEAD, retry.

### Components

#### 1. `paths.ts` — no changes

`WORKTREE_DIR` (`.tbd/data-sync-worktree`) and `DATA_SYNC_DIR_VIA_WORKTREE`
remain per-checkout. The hidden worktree path is unchanged.

#### 2. `git.ts` — worktree lifecycle changes

**`initWorktree(baseDir, remote, syncBranch)`** —
`packages/tbd/src/file/git.ts:903`:

- Replace `git worktree add <path> <branch>` with
  `git worktree add --detach <path> <branch>`.
- For the remote-only path, replace `worktree add -b <branch> <path>
  <remote>/<branch>` with: `git fetch <remote> <branch>; git update-ref
  refs/heads/<branch> <remote>/<branch>; git worktree add --detach <path>
  <branch>`.
- For the orphan path, keep `worktree add --orphan -b <branch> <path>`
  (orphan must be on a branch initially), then immediately after the
  initial commit run `git -C <path> checkout --detach HEAD`.

**New: `findWorktreeOwningBranch(baseDir, branch): Promise<string | null>`**:

- Parses `git -C <baseDir> worktree list --porcelain`.
- Returns the path of the worktree currently attached to `branch`, or
  `null` if no worktree owns it.
- Used by migration and by health checks.

**New: `advanceSyncBranch(baseDir, syncBranch, newHead, expectedOld):
Promise<{ success: boolean; actualHead?: string }>`**:

- Wraps `git -C <baseDir> update-ref refs/heads/<syncBranch> <newHead>
  <expectedOld>`.
- Returns `{ success: true }` on success.
- On CAS failure, captures `actualHead = git rev-parse <syncBranch>` and
  returns `{ success: false, actualHead }` so the caller can do a 3-way
  merge and retry.
- If `expectedOld` is empty (orphan first commit), uses
  `git update-ref refs/heads/<syncBranch> <newHead>` with no old value.

**`checkWorktreeHealth(baseDir)`** — `packages/tbd/src/file/git.ts:771`:

Add a fifth status:

```ts
export type WorktreeStatus =
  | 'valid'      // detached, points at tbd-sync
  | 'missing'
  | 'prunable'
  | 'corrupted'
  | 'attached';  // legacy: worktree exists but is attached, not detached
```

`'attached'` is a *repair-on-sight* state, not an error. Both `tbd sync`
and `tbd doctor` automatically convert attached → detached without
prompting.

**`repairWorktree(baseDir, status, ...)`** — `packages/tbd/src/file/git.ts:1301`:

Add a branch for `status === 'attached'`:

```ts
if (status === 'attached') {
  // Detach in place — no data movement, no backup needed.
  await git('-C', worktreePath, 'checkout', '--detach', syncBranch);
  return { success: true, path: worktreePath };
}
```

**`ensureWorktreeAttached(worktreePath)` →
`ensureWorktreeDetached(worktreePath)`** — `packages/tbd/src/file/git.ts:1360`:

Rename and invert. New behavior: if HEAD is a symbolic ref pointing at
`refs/heads/tbd-sync`, run `git checkout --detach tbd-sync`. The function
already exists, so this is a behavioral inversion. All call sites in
`sync.ts` are updated.

**`updateWorktree(baseDir, ...)`** — `packages/tbd/src/file/git.ts:996`:

After fetching the remote, advance the local `tbd-sync` ref via
`update-ref` (it already does this in some paths) and then run
`git -C <wt> checkout --detach tbd-sync` to refresh HEAD without
attaching.

#### 3. `sync.ts` — write path changes

**`commitWorktreeChanges()`** — `packages/tbd/src/cli/commands/sync.ts:499`:

Pseudocode for the new flow:

```ts
await ensureWorktreeDetached(worktreePath);
const status = await git('-C', worktreePath, 'status', '--porcelain');
if (!status.trim()) return emptyTallies();
const tallies = parseGitStatus(status);

// Capture expected-old before commit so CAS is exact:
const expectedOld =
  await git(baseDir, 'rev-parse', '--verify', `refs/heads/${syncBranch}`)
    .catch(() => ''); // empty repo / orphan first commit

await git('-C', worktreePath, 'add', '-A');
await git('-C', worktreePath, 'commit', '-m', `tbd sync: ...`);
const newHead = await git('-C', worktreePath, 'rev-parse', 'HEAD');

const cas = await advanceSyncBranch(baseDir, syncBranch, newHead, expectedOld);
if (!cas.success) {
  // A sibling advanced tbd-sync between our expectedOld read and our update.
  // Resolve by merging the new tip into our detached HEAD, then retry.
  await git('-C', worktreePath, 'merge', syncBranch,
            '-m', 'tbd sync: incorporate sibling worktree changes');
  const merged = await git('-C', worktreePath, 'rev-parse', 'HEAD');
  const retry = await advanceSyncBranch(baseDir, syncBranch, merged, cas.actualHead!);
  if (!retry.success) {
    // After one merge round we've still raced. Throw a clear error;
    // the user (or a higher-level retry) can re-run tbd sync.
    throw new SyncError(
      `tbd-sync ref advanced concurrently after merge — re-run \`tbd sync\``,
    );
  }
}
return tallies;
```

**Pull (`syncWithRemote`)** — `packages/tbd/src/cli/commands/sync.ts:670`:

After the existing `git -C <worktree> merge origin/tbd-sync` succeeds,
the worktree's detached HEAD has advanced but the branch ref has not.
Wrap it with the same CAS sequence above, replacing `expectedOld` with
the pre-merge `tbd-sync` value.

The conflict-resolution paths (`sync.ts:836-940`) do not need behavioral
changes — they manipulate worktree files and run `git -C <wt> add -A;
git -C <wt> commit`. We only add the post-commit `update-ref` step.

#### 4. `doctor.ts` — health-check changes

`checkWorktree()` (`packages/tbd/src/cli/commands/doctor.ts:821`):

- Add a `case 'attached':` branch that auto-repairs on `--fix` or
  reports an `info`-severity finding otherwise (not an error — it's
  a legacy state, harmless until two checkouts both want the worktree).
- Multi-worktree-of-same-repo is *not* an error condition. Doctor must
  not flag the existence of a sibling worktree's `tbd-sync` claim as
  a problem when this checkout is detached.
- Optionally surface `findWorktreeOwningBranch()` as an info entry
  ("tbd-sync currently attached at /path/to/sibling — this checkout
  uses detached HEAD") so users with many checkouts can see the
  topology.

#### 5. `tbd-design.md` updates

Sections to revise:

- §2.3 "Hidden Worktree Model" — change the `git worktree add ...`
  example to use `--detach`, add a paragraph on "Multi-Checkout Mode."
- §2.3.4 "Worktree Health States" — add `attached` legacy state.
- §3.3.3 "Sync Algorithm" — add explicit `update-ref` CAS step with
  retry-on-conflict.
- §7.1 Decision 7 — annotate that the original "attached worktree"
  choice is superseded by detached + CAS for multi-checkout support;
  link to this spec.

### API Changes

| Public API | Change |
| --- | --- |
| `WorktreeStatus` | Add `'attached'` variant. |
| `checkWorktreeHealth()` | May return `status: 'attached'`. |
| `repairWorktree()` | Accepts `'attached'` status. |
| `ensureWorktreeAttached()` | Renamed to `ensureWorktreeDetached()`, semantics inverted. |
| `findWorktreeOwningBranch()` | New helper. |
| `advanceSyncBranch()` | New helper (CAS wrapper). |
| `tbd sync` CLI | No surface change; behavior gains CAS retry. |
| `tbd doctor` CLI | No surface change; reports/fixes `attached`. |

No new error classes are needed. CAS retry exhaustion uses the existing
`SyncError`.

## Implementation Plan

A single phase. The change set is small, internally consistent, and not
worth splitting across releases.

### Phase 1: Detached-HEAD worktree model

**Code changes:**

- [ ] `packages/tbd/src/file/git.ts`:
  - [ ] Update `initWorktree()` to use `--detach` for the local-branch
        and remote-branch paths; keep `--orphan` for first-time setup
        but follow it with `git checkout --detach HEAD` after the
        initial commit.
  - [ ] Add `WorktreeStatus = 'attached'`.
  - [ ] Update `checkWorktreeHealth()` to report `'attached'` when HEAD
        is a symbolic ref to `refs/heads/tbd-sync`.
  - [ ] Add `findWorktreeOwningBranch(baseDir, branch)` parsing
        `git worktree list --porcelain`.
  - [ ] Add `advanceSyncBranch(baseDir, syncBranch, newHead, expectedOld)`
        wrapping `git update-ref` with CAS semantics.
  - [ ] Rename `ensureWorktreeAttached` → `ensureWorktreeDetached`,
        invert behavior.
  - [ ] Update `repairWorktree()` to handle the `'attached'` case
        (`git -C <wt> checkout --detach <branch>`).
  - [ ] Update `updateWorktree()` to detach HEAD after fetching/pulling.

- [ ] `packages/tbd/src/cli/commands/sync.ts`:
  - [ ] Update import to `ensureWorktreeDetached`.
  - [ ] In `commitWorktreeChanges()`: capture `expectedOld`, commit on
        detached HEAD, then `advanceSyncBranch()` with one merge-and-retry
        on CAS conflict.
  - [ ] In the pull/merge path (around `sync.ts:752-940`): after each
        commit/merge inside the worktree, advance `tbd-sync` via CAS.
  - [ ] Adjust the gitattributes-bootstrap commit (`sync.ts:728-748`) to
        also CAS the ref afterward.
  - [ ] Verify the `withIsolatedIndex` pull path (`sync.ts:471-479`) is
        unchanged — it already uses `update-ref` and is correct.

- [ ] `packages/tbd/src/cli/commands/doctor.ts`:
  - [ ] In `checkWorktree()`: handle `'attached'`. With `--fix`,
        auto-detach silently; without, report info-severity (not an
        error).
  - [ ] Confirm no doctor check flags multi-worktree branch sharing as
        a problem.

- [ ] `packages/tbd/src/file/storage.ts` and `packages/tbd/src/file/workspace.ts`:
  - [ ] Audit for any code that assumes the worktree is attached to
        `tbd-sync` (e.g., reads `git -C <wt> branch --show-current`
        and expects a non-empty result). Update those reads to use
        `git -C <wt> rev-parse HEAD` plus the branch ref where needed.

**Tests** (apply golden-testing methodology — broad state capture in
tryscripts plus targeted unit tests for new primitives; see "Testing
Strategy" below):

- [ ] New tryscript `packages/tbd/tests/cli-sync-multi-worktree.tryscript.md`
      — primary + sibling worktree topology, both run setup/create/sync,
      end-state captured (worktree list porcelain, log, detached check,
      issue count).
- [ ] New tryscript
      `packages/tbd/tests/cli-sync-legacy-attached-migration.tryscript.md`
      — pre-state attached, doctor reports info, `--fix` detaches in
      place, post-state captured.
- [ ] Update `packages/tbd/tests/cli-sync-detached-worktree-bug.tryscript.md`
      (rename to `cli-sync-worktree-ref-advance.tryscript.md`) — flip
      "detached is bug" assertions to "detached is desired; ref is
      advanced via update-ref."
- [ ] Update `packages/tbd/tests/cli-sync-worktree-scenarios.tryscript.md`
      — flip happy-path attached assertions; add scenario 6 "sibling
      worktree of same repo."
- [ ] Update `packages/tbd/tests/cli-sync.tryscript.md` — replace
      `branch --show-current` checks with `symbolic-ref -q HEAD` empty
      checks for the detached state.
- [ ] Unit tests in `packages/tbd/tests/doctor-sync.test.ts` (or new
      `worktree-management.test.ts`): `advanceSyncBranch()` happy +
      CAS-failure + orphan-first paths; `findWorktreeOwningBranch()`
      across all topologies; `ensureWorktreeDetached()` idempotency;
      `checkWorktreeHealth()` returns `'attached'` for legacy worktree.
- [ ] Architectural test: `tbd setup` produces a detached worktree;
      two sibling checkouts can coexist with no owning worktree.
- [ ] Update golden snapshots in `packages/tbd/tests/golden-output.test.ts`
      that print worktree status text (`pnpm test -- -u` to refresh).

**Documentation:**

- [ ] Update `packages/tbd/docs/tbd-design.md` §2.3, §2.3.4, §3.3.3,
      §7.1 Decision 7 as described above.
- [ ] Update `packages/tbd/docs/guidelines/tbd-sync-troubleshooting.md`
      with a "Multiple checkouts of the same repo" subsection.
- [ ] Add a one-paragraph note to `README.md` "How it works"
      noting that tbd supports multiple worktrees of the same repo.
- [ ] Update `release-notes.md` with a "Fixed" entry.

## Testing Strategy

We follow the project's golden-testing methodology
(`tbd guidelines golden-testing-guidelines`): broad-state tryscripts that
diff full command output, plus narrow unit tests for the new primitives.
The combination of "raw diffs reveal unexpected changes" plus "asserted
invariants over filesystem and git state" is what catches behavioral
regressions in worktree handling.

### Unit tests (`packages/tbd/tests/*.test.ts`)

- `advanceSyncBranch()` — happy path advances ref; CAS failure returns
  `actualHead` matching the current ref; orphan first-commit path uses
  no-old-value form.
- `checkWorktreeHealth()` — returns each of the five states
  (`valid`, `missing`, `prunable`, `corrupted`, `attached`).
- `findWorktreeOwningBranch()` — branch attached in primary, branch
  detached everywhere, branch attached in a sibling, no worktree on
  branch, multiple worktrees with different branches.
- `commitWorktreeChanges()` — clean commit advances ref; race triggers
  one merge-and-retry that succeeds; second race throws `SyncError`.
- `ensureWorktreeDetached()` — no-op on already-detached; detaches
  attached worktree without losing HEAD.

### Golden tryscripts (`packages/tbd/tests/*.tryscript.md`)

Each tryscript captures the full command output and the resulting
filesystem/git state, so unintended changes show up as diffs.

**New: `cli-sync-multi-worktree.tryscript.md`**

The headline test for this spec. Sets up a primary checkout plus a
sibling worktree (mirroring the user's codex/agent topology) and
exercises:

1. `tbd setup --auto` succeeds in both worktrees.
2. Each worktree's `.tbd/data-sync-worktree` exists and is detached
   (`git -C ... symbolic-ref -q HEAD` is empty).
3. `tbd create` from each side produces issues with no `fatal:` from
   git.
4. `tbd sync` from one side advances `tbd-sync`; the other side's
   next `tbd sync` merges and re-advances via CAS without conflict.
5. After both sync, `git log tbd-sync --oneline` shows commits from
   both worktrees in causal order.
6. `git worktree list --porcelain` shows both `.tbd/data-sync-worktree`
   entries marked `detached`.
7. The bug-reproduction sequence from the "Reproduction" section above,
   adapted to use `tbd` commands instead of raw git — must produce no
   `fatal: 'tbd-sync' is already used by worktree` line anywhere.

**New: `cli-sync-legacy-attached-migration.tryscript.md`**

Migration of an existing v0.1.26 attached worktree. Captures:

1. Pre-state: worktree is attached
   (`git -C .tbd/data-sync-worktree symbolic-ref HEAD` returns
   `refs/heads/tbd-sync`).
2. `tbd doctor` reports `attached` as info-severity (not error).
3. `tbd doctor --fix` detaches without data movement; output mentions
   "detach" not "backup" / "migrate".
4. Post-state: worktree is detached, branch ref unchanged
   (no commits added during migration).
5. Sibling worktree can now successfully run
   `tbd setup` + `tbd create` + `tbd sync`.

**Update: `cli-sync-detached-worktree-bug.tryscript.md`**
(`packages/tbd/tests/cli-sync-detached-worktree-bug.tryscript.md:1-169`)

Today this script asserts the *old* behavior — that a detached
worktree is a bug, and `ensureWorktreeAttached` re-attaches it.
After the change, detached is the *desired* state. Update the script
to:

1. Rename file to `cli-sync-worktree-ref-advance.tryscript.md`
   (renaming because the file's premise changes).
2. Replace "FIX VERIFICATION" assertions:
   - Old: "worktree gets re-attached"
   - New: "worktree stays detached AND `tbd-sync` ref advanced via
     `update-ref`"
3. Keep the data-migration assertions — those still hold.

**Update: `cli-sync-worktree-scenarios.tryscript.md`**
(`packages/tbd/tests/cli-sync-worktree-scenarios.tryscript.md:1-294`)

Update each "happy-path" scenario to assert detached HEAD instead of
attached. Add a new scenario at the end:

```
## Scenario 6: Sibling worktree of same repo

Tests that a second working tree sharing the same .git can independently
init, create, and sync without `git worktree add` failing.
```

**Update: `cli-sync.tryscript.md`** —
(`packages/tbd/tests/cli-sync.tryscript.md`, sections that grep
`branch --show-current` on the worktree). Replace those with
`symbolic-ref -q HEAD` returning empty for the detached state.

### Golden filesystem assertions (capture-and-diff style)

Per the golden-testing guideline, capture the broad git/filesystem state
inside each tryscript so unintended changes surface as diffs. Each
multi-worktree tryscript should include a final block that captures:

```console
$ git worktree list --porcelain | sort
$ git log tbd-sync --oneline -5
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
$ ls .tbd/data-sync-worktree/.tbd/data-sync/issues/ | wc -l
```

These are the "broad state" probes that catch unexpected behavior
(e.g., a regression that re-attaches the worktree, or a sibling worktree
silently losing its HEAD).

### Architectural tests (`packages/tbd/tests/architectural.test.ts`)

```ts
it('hidden worktree is detached on fresh tbd setup', async () => {
  await run('tbd setup --auto --prefix=test');
  const ref = await git('-C', '.tbd/data-sync-worktree',
                        'symbolic-ref', '-q', 'HEAD').catch(() => '');
  expect(ref).toBe('');  // detached → no symbolic ref
});

it('two sibling worktrees coexist without claiming tbd-sync', async () => {
  await run('tbd setup --auto --prefix=test');
  await git('worktree', 'add', '../sibling', '-b', 'feat');
  // tbd setup in sibling must not throw "already used by worktree"
  await run('tbd setup --auto', { cwd: '../sibling' });
  const owning = await findWorktreeOwningBranch(repoRoot, 'tbd-sync');
  expect(owning).toBe(null);  // nobody owns it; both detached
});
```

### Manual verification

- The Reproduction script above must produce no `fatal:` lines from any
  step after the fix.
- Manually run two `tbd sync` invocations from sibling shells in
  different working trees of the same repo and confirm both succeed
  with the expected merged state.

## Rollout Plan

Single release. The migration of legacy attached worktrees is fully
automatic and silent — the first `tbd sync` or `tbd doctor` after
upgrading detaches the worktree in place (no data movement, no backup
required, since the worktree's HEAD already matches `tbd-sync`).

Mixed-version risk: if one checkout is on the new code and a sibling
checkout is on v0.1.26, the new checkout will use detached + CAS while
the legacy checkout silently advances `tbd-sync` via its attached
worktree. CAS catches the race correctly. The legacy checkout's
working tree may show phantom-deletion status briefly; that's the same
behavior it has today and is harmless. This is documented in release
notes as "upgrade all checkouts."

## Open Questions

1. Should `advanceSyncBranch()` retry the merge loop more than once
   under heavy contention? Recommendation: no — one retry covers the
   normal sibling-commits-during-our-commit race; further retries
   indicate a real conflict that the user should observe.
2. Do we want a CLI flag (`tbd sync --no-cas-retry`) for debugging?
   Recommendation: no, keep the API surface minimal.
3. Should `findWorktreeOwningBranch()` also be exposed in `tbd doctor`
   output ("worktree X owned by /path/Y")? Recommendation: yes,
   info-severity, helpful for users with many checkouts.
4. Future: should `WORKTREE_DIR` move to `git rev-parse
   --git-common-dir`/`tbd/data-sync-worktree` so all checkouts share
   one physical worktree? This is a bigger refactor with its own
   tradeoffs (search paths, gitignore handling). Out of scope for
   this spec; tracked as a follow-up if the detached model proves
   insufficient.

## References

- `packages/tbd/src/file/git.ts:903-985` — current `initWorktree`
- `packages/tbd/src/file/git.ts:1301` — `repairWorktree`
- `packages/tbd/src/file/git.ts:1360` — `ensureWorktreeAttached`
  (to be renamed)
- `packages/tbd/src/cli/commands/sync.ts:471-479` — pull path already
  uses `update-ref` (template for the new push path)
- `packages/tbd/src/cli/commands/sync.ts:499-541` — `commitWorktreeChanges`
- `packages/tbd/docs/tbd-design.md` §2.3, §3.3.3, §7.1 Decision 7
- `docs/project/specs/done/plan-2026-01-28-sync-worktree-recovery-and-hardening.md`
- `docs/project/retrospectives/retro-2026-01-16-worktree-architecture-not-implemented.md`
- Local research session reproduced commands in `/tmp/wt-research`
  (commands transcribed in the "Research" and "Reproduction" sections
  above).
