# Feature: Unrelated-history rescue tolerates a dirty sync worktree (no advice loop)

**Date:** 2026-06-03 (last updated 2026-06-03)

**Author:** Joshua Levy (with agent assistance)

**Status:** Implemented (PR pending)

## Overview

Issue **#158**: when `origin/tbd-sync` and the local `tbd-sync` branch have **unrelated
histories**, `tbd sync` correctly refuses and points to `tbd doctor --fix`. But if the
internal sync worktree is **transiently dirty** at that moment, the rescue
(`rescueUnrelatedHistory`) *also* bails with “the tbd-sync worktree has uncommitted
changes. Commit or stash them, then retry.”
Two problems follow:

1. The user never touches the internal worktree, so “commit or stash them” is misleading
   — the dirtiness is tbd’s own transient data-sync state.
2. `tbd sync` says run `tbd doctor --fix`; `doctor --fix` fails and a separate check
   says run `tbd sync` — a closed **advice loop** with no terminating instruction.

The rescue logic itself is correct: it already snapshots the working tree before its
`reset --hard` and replays local work.
The refusal is **over-cautious**. This is a UX/robustness fix, not a correctness bug in
the merge.

A **secondary** concern in the report — `tbd sync` printing `Error:` but exiting 0 — is
**already fixed on current `main`**: the up-front unrelated-history detection throws
`UnrelatedHistoriesError` (exit code 1), verified empirically.
We lock that in with a test and audit the remaining soft-fail push path.

## Goals

- `tbd doctor --fix` completes the unrelated-history rescue when the only blocker is a
  dirty sync worktree (tbd’s own uncommitted data-sync writes), instead of refusing.
- The `tbd-backup-*` safety branch faithfully captures the pre-rescue state
  **including** any uncommitted worktree changes.
- A genuine **merge-in-progress** in the sync worktree is still refused — with a clear,
  single terminating instruction (no loop).
- `tbd doctor` no longer emits the contradictory `diverged → run tbd sync` suggestion
  when the histories are unrelated (the remediation is the rescue, not sync).
- `tbd sync` exits non-zero on a hard unrelated-history failure (regression-tested), and
  the soft push-failure-to-outbox exit behavior is audited and documented.

## Non-Goals

- No change to the rescue’s reconciliation algorithm (ULID buckets, attic preservation,
  ID-mapping union) — only its dirty-worktree precondition.
- No change to the on-disk format or the unrelated-history *detection* logic.
- Not changing the soft-fail-to-outbox design for recoverable network push failures
  (those intentionally save data and may exit 0); only auditing/clarifying it.

## Background

### Why the dirty refusal is unnecessary (verified against current source)

`rescueUnrelatedHistory` (`packages/tbd/src/file/git.ts:1878`) runs under
`withSharedDataSyncLock` and today refuses up front:

```ts
const dirty = (await git('-C', worktreePath, 'status', '--porcelain')).trim();
if (dirty) {
  throw new Error('Refusing to rescue: the tbd-sync worktree has uncommitted changes. '
    + 'Commit or stash them, then retry.');           // git.ts:1888-1892
}
```

But the steps that follow already make a dirty worktree safe:

- **Step 3 (`git.ts:1908`)** captures `localIssues = await listIssues(dataSyncPath)`
  from the **working tree** — uncommitted issue writes included — and the same for
  `bothDifferent` local sides.
  The replay (step 5) re-writes these onto the adopted remote base, so uncommitted local
  work is **not** lost by the `reset --hard`.
- **The only real gap:** the backup branch (step 2, `git.ts:1913-1916`) is cut from the
  **committed** `localHead`, so it does *not* include uncommitted work.
  If anything went wrong mid-rescue, that uncommitted state would only exist in the
  (about-to-be-reset) working tree.

So the correct fix is not to refuse, but to **commit the pending data-sync state first**
(the worktree is dedicated to `.tbd/data-sync/`), then cut the backup branch from that
inclusive HEAD, then proceed.
The lock guarantees no concurrent writer races this.

A genuine **merge-in-progress** (`MERGE_HEAD` present, `git.ts:1894-1902`) is different
— a half-finished merge is an unsafe base to reset over — so that refusal stays, but
with a terminating message.

### The advice loop (two different checks)

- `classifyRemoteSyncHealth` (`doctor.ts:75-82`) reports unrelated histories → “Run: tbd
  doctor --fix”. With `--fix`, the rescue runs (`doctor.ts:1290-1311`); on the dirty
  refusal it returns `rescue failed: …` + “Resolve manually…”.
- Separately, `checkSyncConsistency` (Check 15, `doctor.ts:1465`) sees ahead>0 &&
  behind>0 (always true for unrelated histories) and emits
  `diverged (N ahead, M behind)` → **“Run: tbd sync to reconcile”**.
- `tbd sync` then says run `tbd doctor --fix`. Loop.

Breaking it: `checkSyncConsistency` must be **unrelated-aware** and not suggest
`tbd sync` when the histories are unrelated (defer to the rescue finding).

### Secondary: sync exit code (already correct on main)

Reproduced an unrelated-history `tbd sync` against current `main`: it prints the
`UnrelatedHistoriesError` and **exits 1** (the up-front detection at `sync.ts:~865`
throws; `UnrelatedHistoriesError extends SyncError` → `exitCode = 1` →
`cli.ts:285-287`). The v0.2.2 “exit 0” came from the older push-failure path.
We add a regression test, and audit the generic push-failure fall-through
(`sync.ts:~1048` `return;`) which still exits 0 for *other* (e.g. network) failures —
that is the deliberate soft-fail-to-outbox behavior; we confirm it only applies when
data was actually saved and document the distinction.

## Design

### Approach

Three small, independently testable changes.
TDD throughout.

### Components

| Area | File | Change |
| --- | --- | --- |
| Rescue precondition | `packages/tbd/src/file/git.ts` `rescueUnrelatedHistory` | If the worktree is dirty (and not a merge-in-progress) and all changes are within the data-sync tree, commit them first; cut the backup branch from that HEAD; proceed. Keep + reword the merge-in-progress refusal. |
| Loop break | `packages/tbd/src/cli/commands/doctor.ts` `checkSyncConsistency` | When `checkRemoteBranchHealth(...).unrelated`, don’t suggest `tbd sync`; defer to the rescue (point at `tbd doctor --fix`, or stay quiet since the Remote-sync-branch check owns it). |
| Rescue-failure message | `doctor.ts` (`:1307-1308`) | Give one terminating next step for the residual merge-in-progress case. |
| Exit-code regression + audit | `packages/tbd/tests/…` + `sync.ts` | Test `tbd sync` exits non-zero on unrelated histories; audit/justify the soft-fail-to-outbox exit-0 path (and make a truly unrecoverable failure non-zero if the audit finds a gap). |

### Detailed design

#### A. Rescue tolerates a dirty worktree

In `rescueUnrelatedHistory`, replace the dirty refusal with a commit-first step.
Sketch:

```ts
// merge-in-progress is genuinely unsafe — refuse with a terminating instruction.
if (await mergeInProgress(worktreePath)) {
  throw new Error(
    'Refusing to rescue: a merge is in progress in the tbd-sync worktree at '
    + `${worktreePath}. Run \`git -C <path> merge --abort\`, then re-run \`tbd doctor --fix\`.`,
  );
}

// A dirty worktree is tbd's own uncommitted data-sync state (this worktree only ever
// holds .tbd/data-sync/). Commit it so the backup branch captures it faithfully and the
// reset is safe. Guard: if anything outside the data-sync tree is dirty, refuse clearly.
const dirty = (await git('-C', worktreePath, 'status', '--porcelain')).trim();
if (dirty) {
  assertOnlyDataSyncPaths(dirty);                 // else: terminating refusal
  await git('-C', worktreePath, 'add', '-A');
  await gitCommit(worktreePath, '--no-verify', '-m',
    'tbd rescue: snapshot uncommitted data-sync state before rescue');
}
// ...then capture localHead (now inclusive), cut backup branch, proceed as today.
```

The existing snapshot/replay (steps 3 & 5) is unchanged; committing first only makes the
backup branch faithful and removes the refusal.

#### B. `checkSyncConsistency` is unrelated-aware

Before returning the `diverged → tbd sync` warning, consult
`checkRemoteBranchHealth(remote, syncBranch)`; if `unrelated`, return a finding that
either stays silent on the suggestion or points at `tbd doctor --fix` — never
`tbd sync`. This is the single edge that closes the loop.

#### C. Exit-code test + push-path audit

- Regression test (integration/tryscript): build unrelated `tbd-sync` roots, run
  `tbd sync`, assert non-zero exit and the `UnrelatedHistoriesError` message.
- Audit `pushChanges`/`fullSync` push-failure handling: confirm the `return;` (exit 0)
  path is reached **only** after a successful outbox save; if a push fails *and* the
  save fails, ensure that exits non-zero.
  Document the soft-vs-hard distinction in a code comment and the spec.

## Implementation Plan

### Phase 1: Rescue tolerates dirty worktree + break the loop

- [x] Failing test: `rescueUnrelatedHistory` against a temp repo with a **dirty** sync
  worktree succeeds (adopts remote base, replays local-only, backup branch includes the
  previously-uncommitted work); a **merge-in-progress** worktree still refuses with the
  terminating message.
  (Red.)
- [x] Implement the commit-first precondition + reworded merge-in-progress refusal.
  (Green.)
- [x] Failing test: `checkSyncConsistency` does not suggest `tbd sync` when histories
  are unrelated. (Red → Green.)
- [x] e2e tryscript: unrelated histories + dirty worktree → `tbd doctor --fix` rescues
  in one shot; `tbd sync` → in sync.
  No `commit or stash` dead-end, no loop.

### Phase 2: Exit-code regression + soft-fail audit

- [x] Regression test: `tbd sync` exits non-zero on unrelated histories.
- [x] Audit the push-failure-to-outbox path; add a test that a push failure whose outbox
  save also fails exits non-zero, and document the soft-fail-exit-0 contract.

## Testing Strategy

- **Unit/integration** — `rescueUnrelatedHistory` dirty-worktree and merge-in-progress
  cases against real `git` (temp repos), asserting backup-branch fidelity and replay.
- **Doctor** — `checkSyncConsistency` unrelated-aware behavior (extend `doctor-*`
  tests).
- **Golden/tryscript** — extend `cli-sync-unrelated-rescue.tryscript.md` (or a sibling)
  with the dirty-worktree path and the exit-code assertion.
  Filter unstable fields (timestamps, ULIDs, backup-branch names) per the golden-testing
  guideline.
- TDD: one failing test per behavior before the fix; keep structural and behavioral
  commits separate.

## Rollout Plan

Lands on `claude/fix-158-unrelated-rescue-dirty-worktree` → draft PR referencing #158.
Phase 1 is the user-facing fix; Phase 2 locks in the exit-code contract.
Ships in the next `get-tbd` release; existing stuck repos are unblocked by upgrading and
re-running `tbd doctor --fix`.

## Open Questions

- **Resolved (per user):** relax the precondition (commit-first), not messaging-only;
  and do the exit-code test **plus** the push-path audit.
- If a dirty worktree ever contains paths outside `.tbd/data-sync/` (should be
  impossible — it is a dedicated worktree), the rescue refuses with a terminating
  message rather than committing foreign changes.
  Confirm no tool writes there.

## References

- Issue: #158 (dirty sync-worktree masks the unrelated-history rescue path).
- `packages/tbd/src/file/git.ts` — `rescueUnrelatedHistory` (1878), dirty refusal
  (1888-1892), merge-in-progress refusal (1894-1902), working-tree snapshot (1908),
  backup branch (1913-1916), `reset --hard` (1923).
- `packages/tbd/src/cli/commands/doctor.ts` — `classifyRemoteSyncHealth` (67), rescue
  invocation (1290-1311), `checkSyncConsistency` (1465).
- `packages/tbd/src/cli/commands/sync.ts` — up-front unrelated detection + throw,
  push-failure fall-through.
  `packages/tbd/src/cli/lib/errors.ts` — `UnrelatedHistoriesError`.
- Prior art: `plan-2026-05-29-tbd-sync-unrelated-history-hardening.md` (introduced the
  rescue and the up-front detection).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
