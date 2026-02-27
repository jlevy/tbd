---
title: "Worktree Sync Branch Conflict: Outbox Fallback"
description: >
  Lower-risk alternative to PR #103 (multi-worktree sync branch isolation).
  When the tbd-sync branch is already checked out in another worktree, detect
  the conflict early and fall back to the outbox workflow instead of showing
  confusing git errors.
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Worktree Sync Branch Conflict — Outbox Fallback

**Date:** 2026-02-27

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

**Supersedes / Alternative to:** PR #103 (feat: isolate sync branches across linked
worktrees)

## Overview

When a tool like Codex creates a linked worktree off the main checkout, and that main
checkout already has a `tbd-sync` branch checked out in its `.tbd/data-sync-worktree/`,
running `tbd sync` in the linked worktree fails with a confusing git error
(`fatal: 'tbd-sync' is already checked out at '...'`).

This spec proposes a **minimal, low-risk fix**: detect the conflict early and route to
the existing outbox workflow.
No new branch management, no function signature changes, no new schema fields.

## Goals

- Eliminate confusing git errors when running `tbd` from a linked worktree
- Preserve all issue data via the existing outbox mechanism (no work lost)
- Give the user a clear, actionable message explaining what happened
- Minimal code changes (~50-100 lines) touching only 2-3 files
- Zero schema/config changes — no new fields in `state.yml` or `config.yml`

## Non-Goals

- Independent sync from multiple worktrees simultaneously (that’s PR #103’s scope, and
  may be the right long-term solution)
- Per-worktree local sync branches or fingerprint naming
- Changes to `doctor`, `init`, `setup`, `status`, or `uninstall` commands

## Background

### The Problem

Git forbids checking out the same local branch in two worktrees simultaneously.
When `tbd sync` calls `initWorktree()`, it runs `git worktree add ... tbd-sync`, which
fails if `tbd-sync` is already checked out in another worktree.

Currently, this error is caught by the generic `try/catch` in `initWorktree()` (line 974
of `git.ts`) and surfaces as a `WorktreeCorruptedError` with raw git output — confusing
and unhelpful.

### The Outbox

tbd already has a robust outbox mechanism (see `workspace.ts`, `saveToWorkspace()`,
`importFromWorkspace()`). When push fails permanently (HTTP 403, etc.), issues auto-save
to `.tbd/workspaces/outbox/`, which is committed to the working branch.
On the next successful `tbd sync`, the outbox is auto-imported.

This spec reuses that same mechanism for worktree branch conflicts.

## Design

### Approach

**Detect → Message → Save to Outbox**

1. Before attempting `initWorktree()`, check if the sync branch is already checked out
   in another worktree using `git worktree list --porcelain`
2. If it is: skip worktree operations entirely, log a clear message identifying the
   other worktree path, and route to the outbox save path
3. The outbox data gets committed to the working branch and auto-imported on the next
   `tbd sync` from the main checkout

### File-Level Change Plan

#### 1. `packages/tbd/src/file/git.ts` — New helper function

**Add: `isSyncBranchCheckedOutElsewhere()`**

Location: After `checkWorktreeHealth()` (~line 892), before `initWorktree()`.

```typescript
/**
 * Check if the sync branch is already checked out in another worktree.
 * This happens when running tbd from a linked worktree (e.g., Codex)
 * while the main checkout already has a tbd data-sync worktree.
 *
 * @param baseDir - The base directory of the repository
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @returns The path of the other worktree if branch is checked out
 *          elsewhere, or null if branch is available
 */
export async function isSyncBranchCheckedOutElsewhere(
  baseDir: string,
  syncBranch: string = SYNC_BRANCH,
): Promise<string | null>
```

Implementation:
- Runs `git worktree list --porcelain` (same call already used in
  `checkWorktreeHealth()`)
- Parses porcelain output to find any worktree entry with
  `branch refs/heads/<syncBranch>`
- Compares that worktree’s path against `baseDir` (normalized) to exclude the current
  repo’s own worktree
- Returns the other worktree’s path if found, `null` otherwise

The porcelain format is:
```
worktree /path/to/checkout
HEAD abc123
branch refs/heads/tbd-sync
```

We look for `branch refs/heads/tbd-sync` entries whose `worktree` path does NOT start
with our own `baseDir`.

#### 2. `packages/tbd/src/cli/commands/sync.ts` — Early detection + outbox routing

**Modify: `run()` method, between line 120 and line 156**

Current flow (simplified):
```
checkWorktreeHealth() → if missing, doRepairWorktree() → if corrupted, throw
```

New flow:
```
checkWorktreeHealth() → if missing:
  check isSyncBranchCheckedOutElsewhere() → if yes:
    log message, save to outbox, return
  else:
    doRepairWorktree() (existing flow)
```

The key insight: when the worktree is `missing` AND the sync branch is checked out
elsewhere, we know we’re in a linked worktree.
Instead of trying to repair (which would fail with the confusing git error), we route to
the outbox.

**Specific changes in `run()`:**

In the `worktreeHealth.status === 'missing'` branch (lines 124-132), before calling
`doRepairWorktree()`:

```typescript
if (worktreeHealth.status === 'missing') {
  // Check if sync branch is checked out in another worktree
  // (e.g., running from a Codex-created linked worktree)
  const otherWorktreePath = await isSyncBranchCheckedOutElsewhere(
    tbdRoot, config.sync.branch,
  );
  if (otherWorktreePath) {
    // Route to outbox workflow
    await this.handleWorktreeBranchConflict(tbdRoot, otherWorktreePath);
    return;
  }

  // Normal missing worktree flow — auto-create
  await this.doRepairWorktree(tbdRoot, 'missing');
  // ... existing code ...
}
```

Note: We need to load config (for `config.sync.branch`) before the worktree health
check. Currently config is loaded at line 161, after the worktree check.
Move the config load (lines 161-169) up to before the worktree health check at line 120.
This is safe — config reading doesn’t depend on worktree state.

**Add: `handleWorktreeBranchConflict()` private method**

New method on the `SyncCommand` class, near `handlePermanentFailure()`:

```typescript
/**
 * Handle the case where the sync branch is checked out in another worktree.
 * Saves issues to outbox and displays a clear message.
 */
private async handleWorktreeBranchConflict(
  tbdRoot: string,
  otherWorktreePath: string,
): Promise<void>
```

Implementation:
- Display a clear info message:
  ```
  ℹ Branch 'tbd-sync' is already checked out in another worktree:
    <otherWorktreePath>

    This happens when running from a linked worktree (e.g., Codex).
    Saving issues to outbox instead.
  ```
- Check if there are any local changes to save (read issues from the direct fallback
  path `.tbd/data-sync/` if it exists, or from the workspace)
- Call `saveToWorkspace(tbdRoot, dataSyncDir, { outbox: true })` if there are issues to
  save
- Display outbox recovery instructions (same as `handlePermanentFailure()`)
- If no issues to save, just display the info message and return cleanly

#### 3. `packages/tbd/src/cli/lib/errors.ts` — (Optional) New error class

**Add: `SyncBranchConflictError`** (optional, for use by other commands)

```typescript
/**
 * Sync branch conflict — the tbd-sync branch is checked out in another
 * worktree, preventing sync operations from this checkout.
 */
export class SyncBranchConflictError extends CLIError {
  constructor(otherPath: string) {
    super(
      `Branch 'tbd-sync' is already checked out in another worktree at: ${otherPath}. ` +
      `Issues have been saved to the outbox. They will sync automatically ` +
      `from the main checkout.`,
      0, // exit code 0 — not a failure, just a different mode
    );
    this.name = 'SyncBranchConflictError';
  }
}
```

This is optional — we may not need a dedicated error class if
`handleWorktreeBranchConflict()` handles everything inline.

### What Does NOT Change

- **`initWorktree()`** — No changes.
  We detect the conflict *before* calling it.
- **`checkWorktreeHealth()`** — No changes to the status enum or detection logic.
- **`ensureWorktreeAttached()`** — No changes.
- **`pushWithRetry()`** — No changes.
- **`doctor` command** — No new checks needed.
- **`init`/`setup`/`status`/`uninstall` commands** — No changes.
- **`state.yml` schema** — No new fields.
- **`config.yml` schema** — No new fields.
- **Function signatures** — No existing function signatures change.

## Implementation Plan

### Phase 1: Core Detection and Fallback

- [ ] Add `isSyncBranchCheckedOutElsewhere()` to `packages/tbd/src/file/git.ts`
- [ ] Move config loading earlier in `sync.ts` `run()` method (before worktree health
  check)
- [ ] Add branch conflict check in the `missing` worktree branch of `sync.ts`
- [ ] Add `handleWorktreeBranchConflict()` method to `SyncCommand` class
- [ ] Add unit test for `isSyncBranchCheckedOutElsewhere()` parsing logic
- [ ] Add integration test (tryscript) for the linked worktree → outbox flow

## Testing Strategy

### Unit Tests

- `isSyncBranchCheckedOutElsewhere()`: Mock `git worktree list --porcelain` output and
  verify correct detection of branch conflicts vs.
  available branches. Test cases:
  - Branch checked out in another worktree → returns path
  - Branch checked out in own worktree only → returns null
  - Branch not checked out anywhere → returns null
  - Multiple worktrees, only one has the branch → returns correct path

### Integration / Tryscript Tests

- Create a linked worktree scenario: `git worktree add` to simulate Codex behavior, run
  `tbd sync`, verify outbox save + clear message + no confusing errors.

## Rollout Plan

1. Implement on feature branch
2. Verify with unit tests and manual testing in a linked worktree scenario
3. Merge to main
4. PR #103 can remain open for future consideration if independent multi-worktree sync
   is needed

## Open Questions

- Should `tbd status` also detect and report the linked worktree situation?
  (Low priority — sync is the main entry point.)
- Should we add a `--force` flag to `tbd sync` to attempt worktree init even when the
  branch is checked out elsewhere?
  (Probably not needed now.)

## References

- PR #103: https://github.com/jlevy/tbd/pull/103
- Existing outbox code: `packages/tbd/src/file/workspace.ts` (`saveToWorkspace`,
  `importFromWorkspace`)
- Sync command: `packages/tbd/src/cli/commands/sync.ts`
- Git worktree helpers: `packages/tbd/src/file/git.ts`
- Error classes: `packages/tbd/src/cli/lib/errors.ts`
