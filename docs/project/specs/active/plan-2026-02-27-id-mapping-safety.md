# Feature: ID Mapping Safety — Prevent Loss of Short ID Entries

**Date:** 2026-02-27

**Author:** Claude (with Joshua Levy)

**Status:** In Review

## Overview

The `ids.yml` file maps 4-character short IDs to 26-character ULIDs and is the backbone
of tbd’s user-facing ID system.
This file is **append-only** by design — entries are never intentionally removed.
Two distinct bugs have been discovered that can cause catastrophic loss of these
mappings, making issues unreachable by short ID.

This spec documents both bugs, the fixes already landed, and the remaining fix needed.

## Goals

- Eliminate all known code paths that can destroy ID mapping entries
- Add defense-in-depth so that even unknown future bugs cannot silently delete mappings
- Ensure all writes to `ids.yml` go through a single, safe code path

## Non-Goals

- Changing the ID mapping format or storage mechanism

## Background

### Bug 1: Concurrent `tbd create` Lost Update (PR #104 — Fixed)

**Root cause:** Classic read-modify-write race condition.
When multiple `tbd create` commands run concurrently (e.g.,
`for i in $(seq 1 5); do tbd create "test-$i" & done`), each process:

1. Loads the same `ids.yml` snapshot
2. Adds its own new mapping entry
3. Writes the file back

The last writer wins, overwriting all entries added by earlier writers.
With 5 concurrent creates, only 1 mapping survives.

**Fix (landed in PR #104):**
- Added `withLockfile()` mutual exclusion using POSIX-atomic `mkdir(2)` as the lock
  primitive (see `packages/tbd/src/utils/lockfile.ts`)
- `saveIdMapping()` now acquires a lockfile, re-reads on-disk state inside the lock,
  merges with in-memory additions, then writes — a proper read-merge-write pattern
- Stale lock detection (30s default) and degraded-mode fallback ensure the system never
  deadlocks

### Bug 2: Migration Overwrites `ids.yml` (This Spec — Not Yet Fixed)

**Root cause:** The `migrateDataToWorktree()` function in `packages/tbd/src/file/git.ts`
uses raw `cp` (file copy) to move mapping files from the wrong location to the worktree.
This **overwrites** the destination `ids.yml` instead of merging.

**Observed failure (2026-02-27):** The tbd-sync branch shows this sequence:

1. Commit `8b0f9d5`: Normal sync adds 20 issue files + 18 lines to `ids.yml` (worktree
   `ids.yml` now has ~3060 lines of accumulated mappings)
2. Commit `7f0da0c`: “migrate 16 file(s) from incorrect location” — adds 16 issue files
   but the `ids.yml` diff shows `3060 ++-`, meaning ~3045 lines were **deleted**. The
   wrong-location `ids.yml` (with only ~15 entries) was copied over the full one.

**Trigger:** `tbd doctor --fix` detects issues in `.tbd/data-sync/` (wrong location) and
calls `migrateDataToWorktree()` to move them to the worktree.
The function correctly copies issue files, but uses a destructive `cp` for `ids.yml`
instead of a merge.

**Why this is different from Bug 1:** Bug 1 is a concurrency race between parallel
writers. Bug 2 is a single-writer logic error — the migration always destroys existing
entries, even in a serial execution.

### Current State of `ids.yml` Write Paths

| Code Path | Uses `saveIdMapping`? | Safe? |
| --- | --- | --- |
| `tbd create` | Yes | Yes (lockfile + merge) |
| `tbd import` | Yes | Yes |
| `tbd sync` (clean merge) | Yes | Yes |
| `tbd sync` (conflict merge) | Yes (x2) | Yes |
| `tbd sync` > outbox import | Yes (via workspace.ts) | Yes |
| `tbd doctor --fix` (dedup) | Yes | Yes |
| `tbd doctor --fix` (missing IDs) | Yes | Yes |
| `saveToWorkspace` (outbox) | Yes | Yes |
| **`migrateDataToWorktree`** | **No (raw `cp`)** | **No — BUG** |

## Design

### Fix for Bug 2: Merge Instead of Copy

In `migrateDataToWorktree()` (`git.ts`), replace the raw `cp` for `ids.yml` with:

```typescript
const sourceMapping = await loadIdMapping(wrongPath);
const targetMapping = await loadIdMapping(correctPath);
const merged = mergeIdMappings(targetMapping, sourceMapping);
await saveIdMapping(correctPath, merged);
```

This reuses the existing `mergeIdMappings()` function (which the workspace code already
uses correctly) and goes through `saveIdMapping()` for the lockfile + safety checks.

### Defense-in-Depth: Append-Only Safety Guard

Add a check in `saveIdMapping()` that refuses to write if the result has fewer entries
than what’s currently on disk:

```typescript
if (merged.shortToUlid.size < currentOnDisk.shortToUlid.size) {
  throw new Error(
    `Refusing to save ID mapping: would lose ${delta} entries. ` +
    `ID mappings are append-only — this indicates a bug.`
  );
}
```

This guard catches any future bug that attempts to shrink `ids.yml`, regardless of the
code path. It works because:

- Mappings are append-only — there is no legitimate operation that removes entries
- Even `tbd doctor --fix` only adds missing entries, never removes them
- The `merge=union` git attribute already protects against merge-based deletion

### Recovery: Improve `tbd doctor --fix` to Restore Deleted Mappings

The existing `checkMissingMappings` in `doctor.ts` already searches git history to
recover original short IDs.
However, it has a flaw that makes it ineffective after this specific bug:

**Current behavior (line 609):**
```typescript
const priorContent = await git('log', '-1', '--format=%H', syncBranch, '--', path);
```

It looks at the **most recent** commit that touched `ids.yml` — but after the migration
bug, the most recent commit is the one that *destroyed* the entries.
So recovery gets the truncated version and finds nothing to recover.

**Fix:** Search the most recent N commits (default 50) that touched `ids.yml` and merge
them all. Since mappings are append-only, the union of historical versions gives us the
complete set of all mappings from that window:

```typescript
const MAX_HISTORY_COMMITS = 50;
const commitLog = await git(
  'log', `-${MAX_HISTORY_COMMITS}`, '--format=%H', syncBranch,
  '--', `${DATA_SYNC_DIR}/mappings/ids.yml`
);
for (const hash of commitLog.trim().split('\n').filter(Boolean)) {
  const content = await git('show', `${hash}:${DATA_SYNC_DIR}/mappings/ids.yml`);
  const versionMapping = parseIdMappingFromYaml(content);
  fullHistoricalMapping = mergeIdMappings(fullHistoricalMapping, versionMapping);
}
```

This approach is robust because:
- It recovers from *any* point where entries were lost within the window
- Merging versions is safe — entries are append-only, so union is always correct
- Capped at 50 commits to avoid scanning thousands on long-lived repos
- 50 is generous — data loss bugs typically happen within a few commits

**Practical impact on this repo:** The ~3045 deleted mappings existed in commit
`8b0f9d5` (the sync commit just before the bad migration).
By looking at all historical commits, `tbd doctor --fix` will find and restore every one
of them.

## Implementation Plan

### Phase 1: Fix Migration + Add Safety Guard

- [x] Add append-only safety guard in `saveIdMapping()` (`id-mapping.ts`)
- [ ] Fix `migrateDataToWorktree()` to merge `ids.yml` instead of copying (`git.ts`)
- [ ] Improve `checkMissingMappings` to search all git history, not just the latest
  commit
- [ ] Add test: migration preserves existing worktree mappings while adding source
  mappings
- [ ] Add test: `saveIdMapping` throws when write would lose entries
- [ ] Verify all existing tests pass (concurrent-mapping, lockfile, etc.)

## Testing Strategy

- Unit test: Create a worktree `ids.yml` with 100 entries, a source `ids.yml` with 5
  entries, run migration merge, verify all 105 entries are present
- Unit test: Attempt to save a mapping with fewer entries than on-disk, verify it throws
- The git history recovery improvement is best validated by running `tbd doctor --fix`
  on the actual affected repo after the code change
- Existing tests: The 13 tests from PR #104 (concurrent-mapping + lockfile) continue to
  validate the concurrent-create fix

## References

- PR #104: fix: Prevent concurrent create from losing short ID mappings
- `packages/tbd/src/file/id-mapping.ts` — ID mapping management
- `packages/tbd/src/file/git.ts` — `migrateDataToWorktree()` function
- `packages/tbd/src/utils/lockfile.ts` — Lockfile utility
- `packages/tbd/src/file/workspace.ts` — Workspace merge (correct implementation)
