# Feature: Shared Common-Dir Sync Worktree

**Date:** 2026-05-17

**Author:** Codex with Joshua Levy

**Status:** Draft

## Overview

`tbd` currently stores its hidden `tbd-sync` checkout under each working tree at
`.tbd/data-sync-worktree/`. That works for a single checkout, but it breaks down when
tools like Codex alternate between the user’s main checkout and new Git worktrees
created for agent sessions.
The immediate pain point is simple: Codex should be able to create and sync beads from
either location without Git reporting that `tbd-sync` is already used by another
worktree, and without losing or stranding bead data.

This spec explores Design B: move the local sync machinery out of each checkout and into
the repository’s Git common directory, then serialize access with the existing
mkdir-based lock pattern.
Every linked worktree of the same repository would use one shared local sync worktree.

## Goals

- Make `tbd create`, `tbd update`, and `tbd sync` work seamlessly whether Codex is
  running in the main checkout or a Codex-created sibling worktree.
- Avoid Git’s “branch already used by worktree” failure for `tbd-sync`.
- Keep issue data repo-scoped, not checkout-scoped, so sibling worktrees observe one
  consistent local tbd state.
- Reuse the existing `withLockfile()` mkdir-based mutual exclusion model where it fits.
- Define a migration path from legacy per-checkout `.tbd/data-sync-worktree/` locations
  without silently dropping unsynced data.
- Keep `.tbd/config.yml`, installed docs, and committed outbox/workspace state in the
  checkout where they already live.

## Non-Goals

- Supporting mixed old/new `tbd` versions as a long-term operating mode.
  Migration should be safe, but once migrated, all checkouts should use the new version.
- Sharing one physical checkout for user code.
  Only tbd’s local sync machinery moves to the Git common directory.
- Replacing remote Git sync semantics.
  `tbd-sync` remains the branch used to exchange issue data through the repository
  remote.
- Designing a new database or daemon.
  This remains file- and Git-based.

## Problem Scope

### The User Workflow That Must Work

The common workflow is:

1. The user has a normal repository checkout on `main`.
2. The user runs Codex in that checkout for some tasks.
3. Codex sometimes creates a separate Git worktree for a branch and runs there instead.
4. Both locations run commands such as `tbd create`, `tbd update`, `tbd ready`, and
   `tbd sync`.

From the user’s perspective, these are the same repository and should share the same
beads. The fact that one command runs from the main checkout and another runs from a
linked worktree should not matter.

### Current Failure Mode

The current per-checkout hidden worktree model creates:

```text
<checkout-a>/.tbd/data-sync-worktree/
<checkout-b>/.tbd/data-sync-worktree/
```

Both worktrees want to use `refs/heads/tbd-sync`. If either hidden worktree is attached
to `tbd-sync`, Git enforces the one-branch, one-worktree rule and the second one fails
with:

```text
fatal: 'tbd-sync' is already used by worktree at ...
```

### Additional Issues To Avoid

- **Split local state:** Per-checkout data paths let the main checkout and Codex
  worktree drift until sync catches up.
- **Dirty-state races:** Detached per-checkout worktrees avoid branch ownership, but
  they introduce subtle local dirty state and compare-and-swap update ordering problems.
- **Legacy unsynced data:** Existing `.tbd/data-sync-worktree/` directories may contain
  dirty files or commits ahead of remote.
  A new location must not ignore those silently.
- **Unknown “main checkout”:** In Codex or cloud agent environments, we should not
  assume we can find or safely mutate a primary working directory.
  The stable anchor is Git’s common directory, not the user’s main checkout path.

## Background

Git linked worktrees share a common Git directory.
From any linked worktree, `git rev-parse --git-common-dir` points to the repository’s
shared Git storage. That common directory is where Git keeps shared refs and
repository-wide data, while each linked worktree has its own private administrative
directory under `$GIT_COMMON_DIR/worktrees/`.

This suggests a better anchor for local tbd sync machinery:

```text
$GIT_COMMON_DIR/tbd/
```

instead of:

```text
<some-checkout>/.tbd/data-sync-worktree/
```

This pattern is consistent with other Git-adjacent tooling that stores local,
repo-scoped implementation data under Git storage:

- Git itself stores linked-worktree admin state under `$GIT_COMMON_DIR/worktrees/`.
- Git LFS stores local object cache data under `.git/lfs/`.
- git-annex stores local annex object data under `.git/annex/`.

## Design

### Approach

Create one shared sync worktree per Git common directory:

```text
$GIT_COMMON_DIR/tbd/
  data-sync-worktree/
    .tbd/data-sync/
      issues/
      mappings/
      attic/
      meta.yml
  locks/
    data-sync.lock/
  backups/
  layout-version
```

Every checkout of the same repository resolves issue data to:

```text
$GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/
```

All mutating operations acquire a common lock before reading, writing, committing,
merging, or repairing the shared sync worktree.

### Why The Git Common Directory, Not The Main Checkout

Some development environments may create linked worktrees where the main checkout is not
obvious, is not mounted where the agent expects, or is not the place the agent should
mutate. Relying on “the main working directory” would make tbd dependent on
environment-specific layout.

`git rev-parse --git-common-dir` is available from any valid linked worktree and points
to shared repository storage.
That is the correct anchor for repo-local tbd machinery.

### Worktree Attachment Model

There are two viable sub-options:

1. **Shared attached worktree:** the shared worktree checks out `tbd-sync` directly.
   Commits naturally advance the branch ref.
2. **Shared detached worktree:** the shared worktree is detached at the `tbd-sync` tip.
   Commits advance HEAD only, and tbd advances `refs/heads/tbd-sync` explicitly.

Preferred draft choice: **shared detached worktree plus common lock**.

Reasons:

- It avoids branch ownership conflicts during migration if any legacy worktree is still
  attached to `tbd-sync`.
- It keeps the shared worktree compatible with Git’s linked-worktree branch rules.
- The common lock makes explicit branch advancement much simpler than the per-checkout
  detached model because only one tbd process should be manipulating the shared worktree
  at a time.

The attached variant is still worth validating in a spike because it may simplify the
write path after legacy migration is complete.

### Locking Model

Use the existing directory-lock pattern from `packages/tbd/src/utils/lockfile.ts`. The
lock path should be under the Git common directory:

```text
$GIT_COMMON_DIR/tbd/locks/data-sync.lock
```

Initial locking policy should be conservative:

- Acquire the lock for `setup`/`init` worktree creation.
- Acquire the lock for all commands that mutate issue files, mappings, attic entries, or
  the sync branch.
- Acquire the lock for `sync`, including local commit, fetch, merge, push, and outbox
  import.
- Acquire the lock for migration and doctor repairs.

Read-only commands can eventually avoid the lock, but the first implementation should
prefer correctness and simple reasoning over maximum concurrency.

The current lock helper is tuned for short file writes.
`tbd sync` can include network operations, so this design likely needs either:

- longer timeout and stale windows for the shared data-sync lock, or
- heartbeat metadata inside the lock directory so long-running sync operations do not
  get broken as stale.

### Path Resolution

Add a Git-common-dir resolver, for example:

```typescript
resolveGitCommonDir(cwd): Promise<string>
resolveSharedTbdDir(tbdRoot): Promise<string>
resolveSharedWorktreePath(tbdRoot): Promise<string>
resolveSharedDataSyncDir(tbdRoot): Promise<string>
```

Important details:

- Use `git rev-parse --path-format=absolute --git-common-dir` where supported, or
  normalize a relative `--git-common-dir` against the current checkout.
- Do not inspect or mutate a “main checkout” path.
- Preserve the existing `.tbd/config.yml` lookup from the current checkout’s repo root.
- Update all data path resolution so production code reads and writes the shared data
  directory, not the legacy per-checkout worktree.

### Migration And Compatibility

New versions should treat the common-dir location as canonical.
Old versions will continue to use per-checkout `.tbd/data-sync-worktree/`. That means
the on-disk layouts can coexist, but mixed-version operation is not clean after
migration.

Migration requirements:

1. Acquire `$GIT_COMMON_DIR/tbd/locks/data-sync.lock`.
2. Discover legacy `.tbd/data-sync-worktree/` entries using
   `git worktree list --porcelain` plus the current checkout’s legacy path.
3. For each accessible legacy worktree:
   - detect whether it is attached, detached, dirty, or ahead of `tbd-sync`;
   - commit dirty data if needed;
   - merge or publish any ahead commits into `tbd-sync`;
   - preserve backups before destructive repair.
4. Initialize or update `$GIT_COMMON_DIR/tbd/data-sync-worktree/` from `tbd-sync`.
5. Leave legacy locations alone initially, or remove them only after a clear successful
   migration and backup.
6. Write `layout-version` so doctor can distinguish old and new local layouts.

Compatibility statement:

- New tbd can read remote state and migrate old local state.
- Old tbd after migration may recreate per-checkout local state.
  This is unsupported and should be reported by doctor as “upgrade all checkouts.”

### Failure Handling

If the shared worktree cannot be initialized or repaired:

- fail with a visible error;
- do not fall back to writing direct `.tbd/data-sync/` in the user checkout;
- point the user to `tbd doctor --fix`;
- preserve any legacy dirty data in backups or outbox before removing anything.

If the lock cannot be acquired:

- fail non-zero for writes and sync;
- report the lock path and stale-lock guidance;
- do not run without mutual exclusion.

## Components

### `packages/tbd/src/lib/paths.ts`

- Add shared Git-common-dir path helpers.
- Change production `resolveDataSyncDir()` to prefer the shared worktree path.
- Keep direct-path fallback only for tests and explicit diagnostics.

### `packages/tbd/src/file/git.ts`

- Add shared worktree initialization and health checks.
- Add migration from legacy per-checkout worktrees.
- Add common-dir layout detection.
- Keep branch/ref operations isolated to the shared worktree and the common lock.

### `packages/tbd/src/utils/lockfile.ts`

- Add or document a long-running lock profile for sync.
- Consider lock metadata and heartbeat support before using stale detection around
  network operations.

### `packages/tbd/src/cli/commands/sync.ts`

- Wrap issue sync operations in the shared data-sync lock.
- Use the shared data-sync directory for all list/read/write operations.
- Ensure push/fetch/merge state cannot be concurrently mutated by sibling worktrees.

### `packages/tbd/src/cli/commands/doctor.ts`

- Report shared-worktree health.
- Detect legacy per-checkout worktrees and classify them as migrated, dirty, ahead, or
  safe to remove.
- Offer `--fix` migration.

### Setup And Uninstall Commands

- `tbd setup --auto` and `tbd init` should initialize the shared worktree if needed.
- `tbd uninstall` should understand both legacy per-checkout and shared common-dir local
  machinery.

## API Changes

Potential internal API additions:

```typescript
interface SharedTbdPaths {
  gitCommonDir: string;
  sharedTbdDir: string;
  sharedWorktreePath: string;
  sharedDataSyncDir: string;
  sharedLockPath: string;
}

type SharedWorktreeStatus =
  | 'valid'
  | 'missing'
  | 'locked'
  | 'legacy-per-checkout'
  | 'dirty-legacy'
  | 'corrupted';
```

No user-facing CLI flags are required for the default workflow.
Doctor output will change to show the shared local sync location.

## Implementation Plan

### Phase 1: Design Spike And Shared Resolver

- [ ] Add a small research tryscript proving a hidden worktree under
  `$GIT_COMMON_DIR/tbd/data-sync-worktree/` works from the main checkout and a linked
  worktree.
- [ ] Add path helpers for absolute Git common directory resolution.
- [ ] Add shared lock path helper.
- [ ] Add shared worktree health detection without changing production writes yet.
- [ ] Add doctor output that reports both the current legacy location and the proposed
  shared location.

### Phase 2: Shared Worktree Write Path

- [ ] Initialize the shared worktree from local or remote `tbd-sync`.
- [ ] Route production `resolveDataSyncDir()` to the shared data-sync directory.
- [ ] Wrap mutating commands and sync in the shared lock.
- [ ] Update sync to commit/merge/push through the shared worktree.
- [ ] Add migration from legacy per-checkout worktrees.
- [ ] Update uninstall and cleanup behavior.
- [ ] Update docs and troubleshooting guidance.

## Testing Strategy

- Unit tests for Git common-dir path resolution from:
  - primary checkout;
  - linked worktree;
  - subdirectory within either checkout.
- Unit tests for shared lock acquisition, timeout, and stale/heartbeat behavior.
- Worktree health tests for:
  - missing shared worktree;
  - valid shared detached worktree;
  - corrupted shared worktree;
  - legacy per-checkout worktree with dirty data;
  - legacy per-checkout worktree with commits ahead of `tbd-sync`.
- Golden tryscript for the user workflow:
  - initialize tbd in the main checkout;
  - create a Codex-style linked worktree;
  - run `tbd create` in both locations;
  - run `tbd sync` in both locations;
  - assert both use the same `$GIT_COMMON_DIR/tbd/data-sync-worktree/`;
  - assert no direct `.tbd/data-sync/` issue files are created;
  - assert no `fatal: 'tbd-sync' is already used by worktree` output appears.
- Golden tryscript for migration:
  - create legacy per-checkout worktree data;
  - create shared worktree;
  - run `tbd doctor --fix`;
  - assert dirty/ahead legacy data is preserved in `tbd-sync`;
  - assert the shared worktree sees the migrated data.
- Full regression suite:
  - `pnpm build`
  - focused worktree tests
  - sync tryscripts
  - full `pnpm test` before landing

## Rollout Plan

This should ship as a local-layout migration.
On first new-version `tbd setup`, `tbd sync`, or `tbd doctor --fix`, tbd should detect
the old per-checkout worktree layout and either migrate it or clearly report why it
cannot be migrated automatically.

Release notes should warn:

- all active checkouts should upgrade together;
- old versions may recreate legacy per-checkout worktrees;
- the new canonical local sync worktree lives under the repository Git common directory,
  not under each checkout.

## Open Questions

- Should the shared worktree be attached to `tbd-sync` after migration, or remain
  detached with explicit branch updates?
- Should read-only commands take the shared lock initially, or only mutating commands?
- What stale-lock policy is safe for sync operations that include network calls?
- Should `tbd doctor --fix` remove old legacy worktrees after migration, or leave them
  in place with a marker file?
- How should backups under `$GIT_COMMON_DIR/tbd/backups/` be exposed to users?
- Do we need an escape hatch for environments where `$GIT_COMMON_DIR` is not writable?

## References

- `docs/development.md`
- `docs/docs-overview.md`
- `docs/project/specs/active/plan-2026-02-27-id-mapping-safety.md`
- `packages/tbd/src/utils/lockfile.ts`
- `packages/tbd/src/lib/paths.ts`
- `packages/tbd/src/file/git.ts`
- Git worktree documentation: https://git-scm.com/docs/git-worktree
- Git repository layout documentation: https://git-scm.com/docs/gitrepository-layout
- Git rev-parse documentation: https://git-scm.com/docs/git-rev-parse
- Git LFS repository-local storage:
  https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md
- git-annex repository-local storage: https://git-annex.branchable.com/
