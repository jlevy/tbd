# Feature: Structured field-level merge for bead YAML in `tbd sync` (no conflict markers, no silent loss)

**Date:** 2026-06-03 (last updated 2026-06-03)

**Author:** Joshua Levy (with agent assistance)

**Status:** Draft

## Overview

Issue **#155** reports that `tbd sync` (v0.2.2) corrupts a bead file when two sessions
concurrently edit the **same epic’s `child_order_hints` list** (and its `version`
counter) before syncing.
Sync delegates reconciliation to git’s **line-based** merge, which writes literal
`<<<<<<< / ======= / >>>>>>>` markers into the bead’s YAML. The markers make the file
invalid YAML; `tbd` then **silently skips** the file (`Skipping invalid issue file: …`),
so the epic and all of its child wiring drop out of the working set.
In at least one path sync still printed `✓ Synced: received N updated` while leaving the
corrupted file behind.

Both conflicting fields are semantically mergeable — `child_order_hints` is an
append-only **set** of child IDs and `version` is a **monotonic counter** — so this
should be a clean auto-merge, never a textual conflict.

The fix is to stop relying on git’s textual merge for bead `.md` files and instead route
every conflicted bead through the project’s **existing** field-level three-way merge
engine (`mergeIssues`), fed with a **real common-ancestor base** so set-union actually
combines both sides.
Sync must also **fail loudly** when any bead fails to parse, rather than reporting
success.

## Goals

- Concurrent edits to a shared epic’s `child_order_hints` merge to the **union** of both
  sides (deduped), and `version` to the **max** — automatically, with no manual repair.
- A bead `.md` file is **never** left on disk (or committed) containing git conflict
  markers.
- If any bead file fails to parse during or after a sync, sync **exits non-zero** and
  names the offending file(s) — it never prints `received N updated` over a corrupted
  store.
- All bead merges in the codebase use one consistent field-level engine and strategy
  table; no path silently drops a side without an attic artifact.

## Non-Goals

- No change to the on-disk storage format (`f04`) or the `git-common-dir-v1` layout.
- No new interactive merge UI.
- No change to the unrelated-history rescue flow
  (`plan-2026-05-29-tbd-sync-unrelated-history-hardening.md`); that path already
  preserves every losing side to `attic/conflicts/` and is reused as-is.
- Not introducing a git custom merge **driver** for issue files (see Open Questions for
  why the post-merge resolution approach is preferred for tbd’s ephemeral-clone use
  case).
- Issue #135 (silent fallback on a missing worktree) is tracked separately and already
  largely fixed; out of scope here.

## Background

### The three coupled defects (verified against current source, v0.2.x)

The single user-visible symptom is produced by three distinct defects that compound:

**Defect A — `child_order_hints` uses the wrong merge strategy.** `FIELD_STRATEGIES`
(`packages/tbd/src/file/git.ts:387`) declares `child_order_hints: 'lww'`, and
`tbd-design.md` §3.5 documents it as “soft ordering, LWW”. But `child_order_hints` is
the parent→child wiring — an append-only set of internal child IDs.
LWW silently discards one session’s appended child on every concurrent edit.
The correct strategy is `union` (dedupe), exactly like `labels` and `dependencies`.
`version` (`max`) and `updated_at` (`max`) are already correct.

**Defect B — the conflict path never actually merges the remote, and passes no base.**
Both conflict-resolution call sites build the merge from the wrong inputs:

- Pull/merge path (`packages/tbd/src/cli/commands/sync.ts:763-785`): after a failed
  `git merge`, for each local issue it does
  `const remoteContent = await git('show', '…origin…:…/<id>.md')` only to test
  existence, then reads the **local** file as the “remote” side
  (`readIssue(this.dataSyncDir, id)`) and calls
  `mergeIssues(null, localIssue, remoteIssue)`. So local and “remote” are identical and
  `base` is `null`.
- Push-retry callback (`packages/tbd/src/cli/commands/sync.ts:531-561`): identical
  mistake — reads `readIssue(this.dataSyncDir, id)` as the remote and passes
  `base = null`.

`base = null` matters because of how `mergeIssues` behaves (below): with a
null/synthetic base, the `union` strategy **never combines both sides**.

**Defect C — corrupted files are silently skipped, and sync still reports success.**
Once git writes markers into the epic file it is invalid YAML. `listIssues`
(`packages/tbd/src/file/storage.ts:110-128`) catches the parse error, prints
`Skipping invalid issue file:` via `console.warn`, and `continue`s. Consequences:

1. The corrupted epic is **excluded** from `localIssues`, so the conflict loop in Defect
   B never even visits it — the markers persist on disk.
2. The epic vanishes from `tbd list`/`ready`/`show`.
3. The “received N updated” tally comes from a `git diff` file count (`sync.ts:643-646`,
   `parseGitDiff`), not from successfully parsed issues, so sync reports
   `✓ Synced: received N updated` even though a bead is unreadable.

The existing `<<<<<<<` safety check (`sync.ts:848-864`) does catch markers **if they
reach `git add`** — that is the “louder” second path the reporter saw — but the primary
failure leaves the file unstaged and the warning easy to miss.

### Why strategy + base are coupled (the key insight)

`mergeIssues` (`packages/tbd/src/file/git.ts:519`) only runs a field’s strategy when
**both** sides differ from the base:

```text
if (localVal == baseVal && remoteVal == baseVal) continue;   // unchanged
if (localVal == baseVal) merged = remoteVal;                 // only remote changed
if (remoteVal == baseVal) merged = localVal;                 // only local changed
// else: both changed -> apply strategy (union/max/lww)
```

When `base` is `null`, `mergeIssues` synthesizes a base from the **lower-version side**
(`git.ts:529-533`). That synthetic base then *equals one of the two sides entirely*, so
for `child_order_hints` one side always satisfies `localVal == baseVal` and the code
takes the **other** side wholesale — the `union` branch is never reached.
**Therefore changing the strategy to `union` is necessary but not sufficient: sync must
also supply a real common-ancestor base so both sides’ additions are present as deltas
and the union actually combines them.**

With a real base `[x]`, `local=[x,A]`, `remote=[x,B]`: both differ → `union` →
`[x,A,B]`. Correct.

### Audit of every bead-merge site (for consistency)

The user asked that the plan be consistent with all existing merging.
Full inventory:

| Site | Base today | Reads remote correctly? | Verdict |
| --- | --- | --- | --- |
| `mergeIssues` engine (`git.ts:519`) | — | — | Keep; flip `child_order_hints` → `union`. All callers benefit. |
| `workspace.ts` save (`:351/:361`) / import (`:477/:487`) | real `older` by `updated_at`, else synthetic | yes (source vs target) | Correct pattern. Loser already routed to attic via `saveConflictToAttic`. No change. |
| Unrelated-history rescue (`git.ts:1858`) | `null` **intentionally** (no common ancestor) | yes (`readBranchIssues`) | Correct by design; preserves every losing side to attic (`git.ts:1860-1864`). No change. |
| Sync pull/merge conflict (`sync.ts:777`) | `null` (bug) | **no** (reads local) | **Fix** (Defect B). |
| Sync push-retry callback (`sync.ts:549`) | `null` (bug) | **no** (reads local) | **Fix** (Defect B). |
| ID mappings: `mergeIdMappings` (union) + `ids.yml merge=union` gitattribute + `resolveIdMappingConflicts` | n/a | yes | Already correct and portable (built-in git union driver). No change. |
| `doc-sync.ts mergeDocCacheConfig` | n/a | n/a | Doc-cache config, unrelated to beads. No change. |

Consistency rules this spec adopts:

- One engine (`mergeIssues`) and one strategy table for **all** bead merges.
- A merge that discards a side must always leave an artifact (attic) — never a silent
  drop and never a raw marker.
- `union` only truly combines when a real base exists; where no common ancestor exists
  (rescue), the established attic-preserve behavior is the correct and intended
  fallback, so flipping `child_order_hints` to `union` is safe there (no regression: the
  losing side is still preserved).

### Why `pushWithRetry` needs different plumbing than the pull path

`pushWithRetry` (`packages/tbd/src/file/git.ts:765`) on a non-fast-forward only does
`git fetch` + `onMergeNeeded()` — it runs **no `git merge`**, so there is **no
conflicted index** (no `:1:/:2:/:3:` stages) in that path.
The pull path (`sync.ts:692-700`) *does* run a real `git merge`, so it is mid-merge with
`HEAD` / `MERGE_HEAD`. A uniform way to derive base/ours/theirs that works for **both**
is `git merge-base <oursRef> <theirsRef>` + `git show <ref>:<path>`, rather than index
stages:

- Pull path (mid-merge): `oursRef = HEAD`, `theirsRef = MERGE_HEAD`.
- Push callback (post-fetch, no merge): `oursRef = <syncBranch>`,
  `theirsRef = <remote>/<syncBranch>`.
- `base = git merge-base oursRef theirsRef` (may be empty → `null`, e.g. add/add).

## Design

### Approach

Introduce one shared helper that performs a **structured three-way merge of a single
bead from git refs**, and route both sync conflict paths through it.
Combined with the strategy flip and a fail-loud guard, markers are never parsed or
written, the union actually unions, and a corrupted store can never masquerade as a
successful sync. Two small phases so each is independently testable; TDD (Red → Green →
Refactor) per project guidelines.

### Components

| Area | File | Change |
| --- | --- | --- |
| Strategy | `packages/tbd/src/file/git.ts` `FIELD_STRATEGIES` | `child_order_hints: 'lww'` → `'union'`. |
| Design doc | `packages/tbd/docs/tbd-design.md` §3.5 | Update rule: `child_order_hints` is an append-only set → `union` (dedupe), with rationale. |
| New helper | `packages/tbd/src/file/git.ts` (e.g. `mergeBeadAcrossRefs`) | Given worktree, dataSyncDir, issueId, `oursRef`, `theirsRef`: compute `base = merge-base`, read base/ours/theirs via `git show <ref>:<path>`, `parseIssue` each (tolerate missing base/file → `null`/skip), call `mergeIssues(base, ours, theirs)`, return `{ merged, conflicts }`. Never reads a marker-laden working file. |
| Pull conflict path | `packages/tbd/src/cli/commands/sync.ts:763-877` | Enumerate conflicted beads via `git diff --name-only --diff-filter=U -- '…/issues/*.md'`; for each, call helper with `HEAD`/`MERGE_HEAD`; `writeIssue` clean result; `git add`; route `conflicts` to attic. Remove the read-local-as-remote logic. |
| Push-retry callback | `packages/tbd/src/cli/commands/sync.ts:531-561` | For each bead differing between `<syncBranch>` and `<remote>/<syncBranch>`, call the same helper; `writeIssue`; collect conflicts. Remove the read-local-as-remote logic. |
| Fail-loud | `packages/tbd/src/cli/commands/sync.ts` (+ `storage.ts` hook) | Thread `listIssues`’ existing `onInvalidIssue`/`InvalidIssueFile` signal through sync’s reads; if any bead is invalid after merge — or any marker survives the safety check — exit non-zero, name the file(s), and suppress the `received N updated` success line. |

### Detailed design

#### Defect A — strategy flip

`child_order_hints: 'union'`. `unionArrays` (`git.ts:475`) already dedupes content-wise,
preserving local order then appending new remote items — exactly the append-only-set
semantics #155 asks for.
Note (documented): `union` does not honor *deletions* (a child removed on one side
reappears if still present on the other), which is consistent with
`labels`/`dependencies` and acceptable because child hints are append-only (children
leave only via reparent/delete, which rewrite the field on both sides over time).

#### Defect B — `mergeBeadAcrossRefs` helper + both call sites

```text
async function mergeBeadAcrossRefs(worktreePath, dataSyncDir, issueId, oursRef, theirsRef):
  path = "<DATA_SYNC_DIR>/issues/<issueId>.md"
  ours   = parseIssue(await gitShow(oursRef:path))      // required
  theirs = parseIssue(await gitShow(theirsRef:path))    // if absent -> nothing to merge
  baseSha = await gitMergeBase(oursRef, theirsRef)       // '' -> null
  base   = baseSha ? parseIssue(await gitShow(baseSha:path)) : null   // tolerate add/add
  return mergeIssues(base, ours, theirs)
```

- Reads come straight from git object refs, so a marker-corrupted **working** file is
  never parsed; the inputs are always valid committed blobs.
- The real `base` makes `union`/`max`/`lww` evaluate against a true ancestor, fixing the
  coupling described in Background.
- Reuses the existing, well-tested `mergeIssues` engine and `attic` conflict routing —
  no new merge semantics.

Pull path: after the `git merge` throws, list conflicted beads with `--diff-filter=U`,
resolve each via the helper, `writeIssue`, `git add`, then the existing safety check +
merge commit complete the merge.
Non-conflicted files git already merged cleanly are untouched.

Push callback: compute the differing bead set between `<syncBranch>` and
`<remote>/<syncBranch>` (e.g. `git diff --name-only`), resolve each via the helper,
`writeIssue`, collect conflicts, return for the existing re-push loop.

#### Defect C — fail loudly, never trust a corrupted store

- `listIssues` already supports `options.onInvalidIssue` and an `InvalidIssueFile`
  shape. Sync’s post-merge reads pass a collector; after merge resolution, if any bead is
  still invalid, throw a `SyncError` naming the files and do **not** emit the success
  summary.
- Keep the `<<<<<<<` staged-content safety check (`sync.ts:848-864`) as a backstop; with
  the structured path it should essentially never fire.
- Reporting: only print `received N updated` when the post-merge store parses cleanly.

### API Changes

- New exported helper in `packages/tbd/src/file/git.ts` (e.g. `mergeBeadAcrossRefs`) for
  unit testing.
- `child_order_hints` strategy value changes (internal table).
- No public CLI flag changes.

## Implementation Plan

### Phase 1: Structured field-level merge (fixes the corruption + data loss)

- [ ] Failing unit test: `mergeIssues` with a real base where both sides append distinct
  `child_order_hints` → union (deduped); `version`/`updated_at` stay `max`. (Red.)
- [ ] Flip `child_order_hints` → `union` in `FIELD_STRATEGIES`; update `tbd-design.md`
  §3.5 and any golden output that pins the strategy table.
  (Green.)
- [ ] Add `mergeBeadAcrossRefs` helper (merge-base + `git show` for base/ours/theirs;
  tolerate missing base/file).
  Unit-test it against a temp repo: ancestor + two divergent appends → clean union, no
  markers; add/add (no base) → falls back to the synthetic-base behavior unchanged.
- [ ] Rewrite the pull/merge conflict path (`sync.ts:763-877`) to enumerate
  `--diff-filter=U` beads and resolve each via the helper (`HEAD`/`MERGE_HEAD`); keep
  attic routing, ids.yml union, and the marker safety check.
- [ ] Rewrite the push-retry callback (`sync.ts:531-561`) to resolve differing beads via
  the same helper against `<syncBranch>`/`<remote>/<syncBranch>`.
- [ ] e2e tryscript modeled on #155: two clones, concurrent `--parent` edits to one
  epic, sync → assert no markers on disk, epic present in `tbd show`,
  `child_order_hints` is the deduped union, `version` is the max.

### Phase 2: Fail loudly on corrupted beads

- [ ] Failing test: a sync that would leave an unparseable bead exits non-zero, names
  the file, and does **not** print `received N updated`. (Red.)
- [ ] Thread `onInvalidIssue` through sync’s reads; throw `SyncError` on any post-merge
  invalid bead; gate the success summary on a clean parse.
  (Green.)
- [ ] Regression assertion in the tryscript: a deliberately corrupted bead makes sync
  fail loudly rather than reporting success.

## Testing Strategy

- **Unit** — `mergeIssues` union/max matrix for `child_order_hints`/`version` with a
  real base; `mergeBeadAcrossRefs` against a temp git repo (ancestor + divergent
  appends; add/add with no base; missing-on-one-side).
- **Integration** — drive a real `git merge` conflict on a bead in a temp worktree and
  assert the resolved file is clean union YAML with no markers, plus an attic entry only
  when a side is genuinely discarded (scalar LWW), never for set/counter fields.
- **Golden/tryscript** — extend the `packages/tbd/tests/cli-sync-*.tryscript.md` family
  with the #155 reproduction and the fail-loud case; filter unstable fields (timestamps,
  ULIDs) per the golden-testing guideline.
- TDD: one failing test per defect before its fix; run the full (non-long) suite each
  step; keep the strategy/doc change and the behavioral merge change in separate
  commits.

## Rollout Plan

Lands on `claude/kind-cori-lSdNU` → draft PR referencing #155. Phase 1 alone stops the
corruption and data loss and is shippable; Phase 2 adds the loud-failure guard.
Ships in the next `get-tbd` release; no migration needed (existing corrupted files are
repaired by re-running sync after upgrade, since the structured path resolves the
markers from git refs).

## Open Questions

- **Resolved (per user):** `child_order_hints` becomes `union` (design doc updated to
  match), and we do the full fix (structured merge + real base + fail-loud), not just
  the strategy flip.
- **Unify the two conflict paths?** The cleanest end state is for the push-retry path to
  perform the same real `git merge` + structured resolution as the pull path, collapsing
  to one merge code path.
  Lean: route both through `mergeBeadAcrossRefs` now (low blast radius); consider fully
  unifying `pushWithRetry` in a follow-up if the duplication proves fragile.
- **Custom git merge driver for `issues/*.md`?** Rejected for now: unlike the built-in
  `merge=union` used for `ids.yml`, a custom driver must be configured per-clone in git
  config; on a fresh/ephemeral clone (tbd’s headline environment) an unconfigured driver
  silently falls back to text merge — re-introducing the exact failure.
  Post-merge structured resolution needs no local git config and is robust on fresh
  clones.

## References

- Issue: #155 (concurrent epic `child_order_hints`/`version` edits → conflict markers →
  silent skip).
- `packages/tbd/src/file/git.ts` — `FIELD_STRATEGIES` (370), `child_order_hints`
  strategy (387), `unionArrays` (475), `mergeIssues` (519), synthetic-base logic
  (529-533), union branch (646), `pushWithRetry` (765), rescue `mergeIssues(null,…)`
  (1858), `GitError` /`exitCodeOf` (29-80).
- `packages/tbd/src/cli/commands/sync.ts` — push callback (531-561), `git merge` (692),
  pull conflict path + marker safety check (763-864), received tally (635-652).
- `packages/tbd/src/file/storage.ts` — `listIssues`/`onInvalidIssue` (76-144).
- `packages/tbd/src/file/workspace.ts` — save/import merges (337-412, 463-499).
- `packages/tbd/docs/tbd-design.md` §3.5 Merge Rules (2224+), `child_order_hints` rule
  (2293).
- Prior art: `plan-2026-05-29-tbd-sync-unrelated-history-hardening.md` (rescue path that
  reuses `mergeIssues` + attic preservation).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
