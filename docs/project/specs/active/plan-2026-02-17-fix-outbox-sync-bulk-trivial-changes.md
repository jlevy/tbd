# Fix: Outbox Sync Bulk Saves and Trivial Version/Timestamp Changes

**Date:** 2026-02-17

**Author:** Claude (with Joshua Levy)

**Status:** In Progress

## Overview

When `tbd sync` fails (e.g., HTTP 403), the outbox recovery mechanism saves ALL issues
(thousands) instead of just the modified ones.
The saved changes are trivial — only `version` and `updated_at` bumps with no
substantive content changes.
This is caused by three interacting bugs in the merge, comparison, and fallback logic.

## Goals

- Prevent trivial version/timestamp-only changes from being treated as real
  modifications
- Ensure the outbox only contains issues with substantive content changes
- Use cached remote state when network is unavailable instead of falling back to saving
  all issues
- Fix the root cause in `mergeIssues()` that gratuitously bumps version on no-op merges
- Add integration tests that reproduce the exact bug scenario end-to-end
- Track the related pre-existing bug in sync merge paths (separate issue)

## Non-Goals

- Optimizing the merge loop to skip `writeIssue` for unchanged issues (performance
  improvement, not a correctness fix)
- Fixing the pre-existing `readIssue` vs `parseIssue` bug in sync.ts merge paths
  (tracked separately as it’s a distinct issue with different risk profile)

## Background

### Observed Symptom

A `tbd sync` commit contained 2231 files, all with only `updated_at` and `version`
changes:

```diff
-updated_at: 2026-02-13T08:39:15.522Z
-version: 32
+updated_at: 2026-02-17T17:00:37.906Z
+version: 36
```

No other fields (title, status, description, labels, etc.)
were modified.

### Root Cause Chain

The bug is a chain of three interacting problems:

**Bug 1: `mergeIssues()` always bumps version/updated_at (even for no-op merges)**

In `git.ts`, the merge function unconditionally executes:
```typescript
merged.version = Math.max(local.version, remote.version) + 1;
merged.updated_at = now();
```

During sync, when a git merge conflict occurs, the code iterates ALL local issues and
merges each with the remote version (`sync.ts:757-774`). Because `mergeIssues` always
bumps, every merged issue gets a new `version` and `updated_at` — even when the merge
produces identical content.

**Bug 2: `getUpdatedIssues()` uses `deepEqual` which includes version/updated_at**

When saving to the outbox, `getUpdatedIssues()` used `deepEqual()` to compare local vs
remote.
Since ALL issues now have different `version`/`updated_at` from Bug 1, ALL appear
“modified” and get saved to the outbox.

**Bug 3: `saveToWorkspace()` falls back to saving ALL issues when fetch fails**

When the network is down (the same condition that caused the push failure), the outbox
save code tried to fetch remote for comparison.
When fetch failed, it fell back to saving every single issue — even though the local
repo already has a cached `origin/tbd-sync` ref from a previous fetch.

### Comprehensive Audit Findings

A systematic audit of the entire sync/merge/outbox pipeline revealed additional bugs
beyond the initial three.
All findings are tracked as beads.

#### CRITICAL: Merge paths read local data instead of remote (tbd-uwo3)

In `sync.ts` lines 614-623 and 764-765, both `doPushWithRetry` and `fullSync` merge
conflict resolution paths read
`remoteIssue = await readIssue(this.dataSyncDir, localIssue.id)` instead of parsing
`remoteContent` from `git show`. This means the “remote” issue is actually read from the
local worktree, so the merge is effectively merging the issue with itself.
**Remote changes are silently dropped during every merge conflict resolution.** The
no-op merge detection in this fix masks the bug for the common case but the underlying
data loss risk remains for true conflicts.

#### HIGH: pushWithRetry aborts on informational LWW conflicts (tbd-5fsb)

In `git.ts` lines 659-661, `pushWithRetry` returns `{ success: false }` whenever
`onMergeNeeded()` produces any conflicts.
But LWW conflicts are informational (one side won, loser goes to attic) — they are not
blocking errors. This means any merge that involves LWW resolution causes push to abort
even though the merge was successful.

#### HIGH: Synthetic base in mergeIssues favors wrong input (tbd-f1nl)

In `git.ts` lines 436-439, when `base=null` and `created_at` timestamps match, the code
uses the lower-versioned issue as the synthetic base.
Since one input IS the base, that input’s fields appear “unchanged from base” and the
other side always wins by default — regardless of LWW timestamps.
This biases merge results incorrectly.

#### HIGH: fullSync merge path drops remote-only new issues (tbd-2jbx)

In `sync.ts` lines 757-774, the merge conflict resolution iterates only local issues.
New issues created on the remote are never discovered or pulled in during conflict
resolution.

#### MEDIUM: deepEqual treats null and undefined differently (tbd-hqsu)

`deepEqual(null, undefined)` returns `false`. Since YAML parsing can produce either
`null` or `undefined` for missing optional fields, this can cause spurious conflicts
when comparing issues across different parse contexts.

#### Additional findings (lower severity, not individually tracked)

- `fullSync` outer try/catch at line 836 swallows all merge/commit errors, not just “no
  remote” (`sync.ts:836-839`)
- `withIsolatedIndex` mutates `process.env` globally, not concurrency-safe
  (`git.ts:203-218`)
- Duplicated merge logic in `saveToWorkspace` and `importFromWorkspace` (DRY violation)
- Attic entries record `now()` instead of actual issue timestamps
  (`workspace.ts:213-215`)
- `readRemoteIssues` silently skips unparseable issues without logging
- `--force` flag accepted but never implemented (`sync.ts:663`)
- `--limit=10` is not a valid git log flag, should be `-n 10` (`sync.ts:422`)
- Hardcoded outbox path instead of using path helpers (`sync.ts:976`)

## Design

### Approach

Three targeted fixes for the immediate outbox bulk save problem, each addressing one bug
in the chain:

1. **Add `issuesSubstantivelyEqual()` function** — compares two issues ignoring
   metadata-only fields (`version`, `updated_at`)
2. **Fix `mergeIssues()` no-op detection** — skip version/timestamp bump when the merge
   result is substantively identical to the highest-versioned input
3. **Fix `saveToWorkspace()` fallback** — separate fetch from comparison so cached
   `origin/tbd-sync` ref is used when fetch fails

The related critical/high bugs are tracked separately for focused follow-up, as they
have different risk profiles and testing requirements.

### Components

| File | Change |
| --- | --- |
| `packages/tbd/src/file/git.ts` | Add `issuesSubstantivelyEqual()`, fix `mergeIssues()` |
| `packages/tbd/src/file/workspace.ts` | Use `issuesSubstantivelyEqual` in `getUpdatedIssues()`, restructure `saveToWorkspace()` fetch/compare |
| `packages/tbd/tests/merge.test.ts` | Update version strategy test, add no-op detection and `issuesSubstantivelyEqual` tests |
| `packages/tbd/tests/workspace.test.ts` | Add test for metadata-only filtering in `getUpdatedIssues()` |
| `packages/tbd/tests/git-remote.test.ts` | Integration test reproducing the bulk outbox bug end-to-end |

### Detailed Behavior Specification

#### `issuesSubstantivelyEqual(a, b)`

- Compares all fields in `FIELD_STRATEGIES` **except** `version` and `updated_at`
- Returns `true` if all substantive fields are `deepEqual`
- Iterates `Object.keys(FIELD_STRATEGIES)` to ensure coverage of all Issue fields
  (TypeScript enforces `FIELD_STRATEGIES: Record<keyof Issue, MergeStrategy>`)
- The set of excluded fields is defined as `METADATA_ONLY_FIELDS` constant

#### `mergeIssues()` no-op detection

After the field-by-field merge loop, before bumping version:
1. Determine `latest` = whichever of `local` or `remote` has the higher version
2. If `issuesSubstantivelyEqual(merged, latest)` → return `{ ...latest }` without
   bumping
3. Otherwise → bump version as before: `max(local.version, remote.version) + 1`

This means:
- Two identical issues merged → returns higher-versioned one, no bump
- One-sided change → returns the changed side (which IS the latest), no bump
- True three-way merge (both changed different fields) → bumps version

#### `getUpdatedIssues()` filtering

- Uses `issuesSubstantivelyEqual` instead of `deepEqual`
- Issues differing only in `version`/`updated_at` are NOT treated as modified
- Issues with any substantive field change (title, status, labels, etc.)
  are included

#### `saveToWorkspace()` fetch/compare resilience

- Fetch and comparison are separated into independent try/catch blocks
- If fetch fails, the cached `origin/tbd-sync` ref is still used for comparison
- Only falls back to saving all issues when no cached state exists at all (first sync)

## Implementation Plan

### Phase 1: Core Fixes (DONE)

- [x] Add `METADATA_ONLY_FIELDS` constant and `issuesSubstantivelyEqual()` to `git.ts`
- [x] Fix `mergeIssues()` to detect no-op merges and skip version/timestamp bump
- [x] Update `getUpdatedIssues()` in `workspace.ts` to use `issuesSubstantivelyEqual`
- [x] Restructure `saveToWorkspace()` to separate fetch from comparison
- [x] Update merge unit tests for new version-bump behavior
- [x] Add `issuesSubstantivelyEqual` unit tests (7 cases)
- [x] Add `getUpdatedIssues` tests for metadata-only filtering (2 cases)
- [x] Add no-op merge detection tests (3 cases)
- [x] All 994 tests pass, typecheck clean, lint clean

### Phase 2: Integration Test and Validation (TODO — tbd-5ism)

- [ ] Write integration test in `git-remote.test.ts` that reproduces the exact bug:
  1. Set up two repos sharing a bare remote
  2. Create N issues, push to tbd-sync from one repo
  3. In second repo, pull tbd-sync, call `mergeIssues()` on all issues
  4. Verify version is NOT bumped for unchanged issues (no-op detection works)
  5. Call `getUpdatedIssues()` and verify only substantively changed issues are returned
  6. Call `saveToWorkspace()` with outbox and verify only changed issues are saved
- [ ] Test should FAIL when fixes are reverted (TDD validation — manually verify once)
- [ ] Add edge case tests for `issuesSubstantivelyEqual` (tbd-cn4w):
  - Optional/nullable fields (`description: null` vs `description: undefined`)
  - `extensions` field with nested data
  - `dependencies` array with object elements
  - No-op merge with conflicts recorded

### Phase 3: Documentation (TODO — tbd-r68s)

- [ ] Update `tbd-sync-troubleshooting` guideline with new “Bulk trivial changes”
  section explaining the fix and how it prevents the symptom

### Phase 4: Related Bug Fixes (Separate Scope)

These are pre-existing bugs discovered during the audit, tracked as separate beads:

- tbd-uwo3 (P1): sync.ts merge paths read local instead of remote — data loss risk
- tbd-5fsb (P1): pushWithRetry aborts on informational LWW conflicts
- tbd-f1nl (P1): mergeIssues synthetic base favors wrong input with null base
- tbd-2jbx (P1): fullSync merge path drops remote-only new issues
- tbd-hqsu (P2): deepEqual null/undefined inconsistency causes spurious conflicts

## Testing Strategy

### Unit Tests (DONE)

| Test | File | Status |
| --- | --- | --- |
| `issuesSubstantivelyEqual` — identical issues | `merge.test.ts` | Pass |
| `issuesSubstantivelyEqual` — version-only differs | `merge.test.ts` | Pass |
| `issuesSubstantivelyEqual` — updated_at-only differs | `merge.test.ts` | Pass |
| `issuesSubstantivelyEqual` — both metadata differ | `merge.test.ts` | Pass |
| `issuesSubstantivelyEqual` — title differs | `merge.test.ts` | Pass |
| `issuesSubstantivelyEqual` — status differs | `merge.test.ts` | Pass |
| `issuesSubstantivelyEqual` — labels differ | `merge.test.ts` | Pass |
| `mergeIssues` no-op (identical issues) | `merge.test.ts` | Pass |
| `mergeIssues` no-op (one-sided change) | `merge.test.ts` | Pass |
| `mergeIssues` version bump (true merge) | `merge.test.ts` | Pass |
| `mergeIssues` no-bump when no substantive changes | `merge.test.ts` | Pass |
| `mergeIssues` bump when substantive changes | `merge.test.ts` | Pass |
| `getUpdatedIssues` excludes metadata-only changes | `workspace.test.ts` | Pass |
| `getUpdatedIssues` includes substantive changes | `workspace.test.ts` | Pass |

### Integration Tests (TODO)

| Test | File | Status |
| --- | --- | --- |
| End-to-end: merge all issues → outbox only has changed | `git-remote.test.ts` | TODO |
| Revert check: test fails without fixes | manual | TODO |

### Edge Case Tests (TODO)

| Test | File | Status |
| --- | --- | --- |
| `issuesSubstantivelyEqual` with null vs undefined | `merge.test.ts` | TODO |
| `issuesSubstantivelyEqual` with extensions | `merge.test.ts` | TODO |
| `issuesSubstantivelyEqual` with dependencies | `merge.test.ts` | TODO |
| No-op merge with conflicts recorded | `merge.test.ts` | TODO |

## Open Questions

- Should the merge loop in `sync.ts` (lines 757-774 and 601-639) skip `writeIssue` for
  no-op merges as a performance optimization?
  Currently it writes identical content which is harmless but wasteful for large repos.
- Should `{ ...latest }` in the no-op merge path use `structuredClone()` instead of
  spread to avoid shallow-copy aliasing risks with arrays/objects?
  (Currently safe because `writeIssue` serializes to disk, but fragile if any future
  caller mutates in-place.)
- Should `deepEqual` normalize `null`/`undefined` before comparison to prevent spurious
  differences from YAML parsing inconsistencies?
  (Tracked as tbd-hqsu.)

## Tracked Beads

| Bead | Type | Priority | Description |
| --- | --- | --- | --- |
| tbd-5ism | task | P1 | Integration test: reproduce bulk outbox save bug end-to-end |
| tbd-cn4w | task | P2 | Edge case tests for issuesSubstantivelyEqual |
| tbd-r68s | task | P2 | Update tbd-sync-troubleshooting guideline |
| tbd-uwo3 | bug | P1 | sync.ts merge paths read local instead of remote (data loss) |
| tbd-5fsb | bug | P1 | pushWithRetry aborts on informational LWW conflicts |
| tbd-f1nl | bug | P1 | mergeIssues synthetic base favors wrong input |
| tbd-2jbx | bug | P1 | fullSync merge path drops remote-only new issues |
| tbd-hqsu | bug | P2 | deepEqual null/undefined inconsistency |

## References

- Commit: `75f6c6b` — Initial fix implementation (Phase 1)
- Related spec: `plan-2026-01-28-sync-worktree-recovery-and-hardening.md`
- Related guideline: `tbd-sync-troubleshooting`
- Bug report: User observed 2231-file sync commit with only version/timestamp changes
